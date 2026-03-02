const { createAgent, tool } = require("langchain");
const { ChatOpenAI } = require("@langchain/openai");
const { HumanMessage, AIMessage, SystemMessage } = require("@langchain/core/messages");
const { z } = require("zod");
const config = require("../config");

/**
 * AIConversationManager
 * Uses LangChain createAgent for proper ReAct-style agent execution
 */
class AIConversationManager {
    constructor(agentConfig, vectorSearchFn, memoryWindowSize = 10) {
        this.agentConfig = agentConfig;
        this.vectorSearchFn = vectorSearchFn;
        this.memoryWindowSize = memoryWindowSize;

        this.tools = [];
        this._initializeTools();

        // Initialize the LLM
        this.llm = new ChatOpenAI({
            model: agentConfig.model || "gpt-4o-mini",
            temperature: agentConfig.temperature || 0.7,
            maxTokens: agentConfig.maxTokens || 500,
            apiKey: config.OPENAI_API_KEY,
        });

        // Agent will be created when generateResponse is called
        this.agent = null;
    }

    /* ======================= TOOLS ======================= */

    _initializeTools() {
        // Tool: Get current time
        const getCurrentTimeTool = tool(
            async ({ timezone }) => {
                const tz = timezone || "UTC";
                try {
                    const dt = new Date().toLocaleString("en-US", {
                        timeZone: tz,
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZoneName: "short",
                    });
                    console.log(`[Tool: get_current_time] Time in ${tz}: ${dt}`);
                    return dt;
                } catch (error) {
                    console.error(`[Tool: get_current_time] Error: ${error.message}`);
                    return `Error getting time for timezone "${tz}": ${error.message}`;
                }
            },
            {
                name: "get_current_time",
                description: "Get the current date and time. Use this when the user asks about the current time, date, day, or any time-related questions.",
                schema: z.object({
                    timezone: z.string().describe("The timezone to get time for (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Defaults to UTC if not specified."),
                }),
            }
        );

        // Tool: Search knowledge base
        const searchKnowledgeBaseTool = tool(
            async ({ query }) => {
                try {
                    console.log(`[Tool: search_knowledge_base] Searching for: "${query}"`);
                    const results = await this.vectorSearchFn(query);

                    if (!results || results.length === 0) {
                        console.log(`[Tool: search_knowledge_base] No results found`);
                        return "No relevant information found in the knowledge base for this query.";
                    }

                    console.log(`[Tool: search_knowledge_base] Found ${results.length} results`);

                    const formattedResults = results
                        .map((r, i) => `[Source ${i + 1}]: ${r.content}`)
                        .join("\n\n---\n\n");

                    return formattedResults;
                } catch (error) {
                    console.error(`[Tool: search_knowledge_base] Error: ${error.message}`);
                    return `Error searching knowledge base: ${error.message}`;
                }
            },
            {
                name: "search_knowledge_base",
                description: "Search the internal knowledge base for information. Use this tool when you need to find specific information, answer factual questions, or retrieve context from stored documents.",
                schema: z.object({
                    query: z.string().describe("The search query to find relevant information in the knowledge base. Be specific and include relevant keywords."),
                }),
            }
        );

        this.tools.push(getCurrentTimeTool, searchKnowledgeBaseTool);
    }

    /**
     * Add a custom tool to the agent
     */
    addTool(customTool) {
        this.tools.push(customTool);
        // Reset agent so it gets recreated with new tools
        this.agent = null;
    }

    /* ======================= AGENT CREATION ======================= */

    /**
     * Build the system prompt with tool instructions
     */
    _buildSystemPrompt(customPrompt) {
        const baseInstructions = ``;

        if (customPrompt && customPrompt.trim()) {
            return `${customPrompt}\n\n${baseInstructions}`;
        }

        return baseInstructions;
    }

    /**
     * Create or get the agent instance
     */
    _getAgent(systemPrompt) {
        // Always create a fresh agent with the current system prompt
        this.agent = createAgent({
            model: this.llm,
            tools: this.tools,
            systemPrompt: systemPrompt,
        });

        return this.agent;
    }

    /* ======================= MESSAGE HANDLING ======================= */

    /**
     * Format chat history to LangChain message format
     */
    _formatChatHistory(chatHistory) {
        const messages = [];
        const sliced = chatHistory.slice(-this.memoryWindowSize * 2);

        for (const msg of sliced) {
            if (msg.role === "user") {
                messages.push({ role: "user", content: msg.message });
            } else if (msg.role === "assistant") {
                messages.push({ role: "assistant", content: msg.message });
            }
        }

        return messages;
    }

    /* ======================= EXECUTION ======================= */

    /**
     * Generate a response using the agent
     */
    async generateResponse(userQuery, chatHistory = [], systemPrompt = "") {
        const fullSystemPrompt = this._buildSystemPrompt(systemPrompt);
        const agent = this._getAgent(fullSystemPrompt);

        // Format chat history and add current query
        const historyMessages = this._formatChatHistory(chatHistory);
        const messages = [
            ...historyMessages,
            { role: "user", content: userQuery },
        ];

        console.log(`[AIConversationManager] Invoking agent with ${messages.length} messages`);

        try {
            // Invoke the agent - it handles the ReAct loop automatically
            const result = await agent.invoke({ messages });

            // Get the last message from the result (the final AI response)
            const lastMessage = result.messages[result.messages.length - 1];
            const responseContent = lastMessage.content || "I'm sorry, I couldn't generate a response.";

            console.log(`[AIConversationManager] Agent response received`);

            // Extract usage from the response metadata if available
            const usage = {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
            };

            // Aggregate token usage from all AI messages
            for (const msg of result.messages) {
                if (msg.response_metadata?.usage) {
                    const msgUsage = msg.response_metadata.usage;
                    usage.promptTokens += msgUsage.prompt_tokens || 0;
                    usage.completionTokens += msgUsage.completion_tokens || 0;
                    usage.totalTokens += msgUsage.total_tokens || 0;
                }
            }

            return {
                content: responseContent,
                usage,
            };
        } catch (error) {
            console.error(`[AIConversationManager] Agent error:`, error);
            throw error;
        }
    }

    /* ======================= STREAMING ======================= */

    /**
     * Stream a response using the agent
     */
    async *streamResponse(userQuery, chatHistory = [], systemPrompt = "") {
        const fullSystemPrompt = this._buildSystemPrompt(systemPrompt);
        const agent = this._getAgent(fullSystemPrompt);

        const historyMessages = this._formatChatHistory(chatHistory);
        const messages = [
            ...historyMessages,
            { role: "user", content: userQuery },
        ];

        try {
            const stream = await agent.stream(
                { messages },
                { streamMode: "values" }
            );

            for await (const chunk of stream) {
                const latestMessage = chunk.messages[chunk.messages.length - 1];
                if (latestMessage?.content && !latestMessage.tool_calls?.length) {
                    yield latestMessage.content;
                }
            }
        } catch (error) {
            console.error(`[AIConversationManager] Stream error:`, error);
            yield "I apologize, but I encountered an error while generating the response.";
        }
    }

    /* ======================= UTILITY METHODS ======================= */

    /**
     * Get the list of available tools
     */
    getAvailableTools() {
        return this.tools.map((t) => ({
            name: t.name,
            description: t.description,
        }));
    }

    /**
     * Update the LLM configuration
     */
    updateLLMConfig(llmConfig) {
        if (llmConfig.model) this.llm.model = llmConfig.model;
        if (llmConfig.temperature !== undefined) this.llm.temperature = llmConfig.temperature;
        if (llmConfig.maxTokens) this.llm.maxTokens = llmConfig.maxTokens;
        // Reset agent to use new config
        this.agent = null;
    }
}

module.exports = AIConversationManager;