import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { supabase } from "../services/supabaseClient";
import { OpenRouterService, ChatMessage } from "../services/openrouter";

export class ChatController {
  /**
   * Create a new chat session for a user.
   */
  static async createSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { user_id } = req.body;
      if (!user_id) {
        res.status(400).json({ error: "user_id is required" });
        return;
      }

      // Check user authorization
      if (req.user.id !== user_id) {
        res.status(403).json({ error: "Unauthorized operation" });
        return;
      }

      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id,
          title: "New Chat",
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        session_id: data.id,
        title: data.title,
        created_at: data.created_at,
      });
    } catch (error: any) {
      console.error("[Create Session Error]:", error);
      res.status(500).json({ error: error.message || "Failed to create session" });
    }
  }

  /**
   * Retrieve all chat sessions for a user.
   */
  static async getUserSessions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ error: "userId parameter is required" });
        return;
      }

      if (req.user.id !== userId) {
        res.status(403).json({ error: "Unauthorized access" });
        return;
      }

      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      res.status(200).json(data);
    } catch (error: any) {
      console.error("[Get User Sessions Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch sessions" });
    }
  }

  /**
   * Retrieve all messages for a session.
   */
  static async getSessionMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        res.status(400).json({ error: "sessionId parameter is required" });
        return;
      }

      // Verify session ownership
      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.user_id !== req.user.id) {
        res.status(403).json({ error: "Unauthorized access to session" });
        return;
      }

      const { data: messages, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Map roles
      const formatted = (messages || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));

      res.status(200).json(formatted);
    } catch (error: any) {
      console.error("[Get Session Messages Error]:", error);
      res.status(500).json({ error: error.message || "Failed to fetch messages" });
    }
  }

  /**
   * Post message and stream response (SSE).
   */
  static async streamMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { session_id, message } = req.body;
      if (!session_id || !message) {
        res.status(400).json({ error: "session_id and message are required" });
        return;
      }

      // 1. Verify session ownership
      const { data: session, error: sessionError } = await supabase
        .from("chat_sessions")
        .select("user_id, title")
        .eq("id", session_id)
        .single();

      if (sessionError || !session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      if (session.user_id !== req.user.id) {
        res.status(403).json({ error: "Unauthorized session access" });
        return;
      }

      // 2. Fetch history of the session to pass context
      const { data: history, error: historyError } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("session_id", session_id)
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;

      // 3. Save user message to database
      const { error: saveUserErr } = await supabase.from("chat_messages").insert({
        session_id,
        role: "user",
        content: message,
      });
      if (saveUserErr) throw saveUserErr;

      // Set headers for Server-Sent Events (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders(); // Establish connection

      // 4. Construct prompt context
      const systemPrompt = `You are a helpful and experienced IELTS AI Mentor. Your task is to assist students in preparing for their IELTS exam.
Help them with grammar, vocabulary, reading strategies, writing structures, speaking outlines, and general prep advice.
Always be encouraging, professional, and clear. Align your guidance with official IELTS band descriptions. Use markdown formatting where appropriate (bolding, lists, code boxes, tables).`;

      const apiMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ];

      // Stream completion
      let assistantResponse = "";

      await OpenRouterService.streamCompletion(
        apiMessages,
        (token) => {
          assistantResponse += token;
          // Send SSE formatted data token
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        },
        async () => {
          // On stream end, save response in background
          try {
            await supabase.from("chat_messages").insert({
              session_id,
              role: "assistant",
              content: assistantResponse,
            });

            // Update session updated_at timestamp
            await supabase
              .from("chat_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", session_id);

            // Auto-rename chat title if it is "New Chat" and this is the first message exchange
            if (session.title === "New Chat" && (!history || history.length === 0)) {
              const cleanedTitle =
                message.length > 25 ? message.slice(0, 25).trim() + "..." : message;
              await supabase
                .from("chat_sessions")
                .update({ title: cleanedTitle })
                .eq("id", session_id);
            }
          } catch (saveErr) {
            console.error("[Error saving assistant message]:", saveErr);
          }
          res.write("data: [DONE]\n\n");
          res.end();
        },
        (error) => {
          console.error("[Streaming Error]:", error);
          res.write(`data: ${JSON.stringify({ error: "Failed to stream message" })}\n\n`);
          res.end();
        }
      );
    } catch (error: any) {
      console.error("[Stream Message Router Error]:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  }
}
