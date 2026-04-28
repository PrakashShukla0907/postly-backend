// Content Service - AI content generation via OpenAI or Anthropic
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getDecryptedAiKeys } from "./userService.js";
import { AppError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

// Platform-specific content constraints
const PLATFORM_CONSTRAINTS = {
  twitter: {
    maxChars: 280,
    style: "max 280 characters, 2-3 hashtags, punchy opener.",
  },
  linkedin: {
    maxChars: 1300,
    style: "800-1300 characters, professional tone regardless of global tone setting, 3-5 hashtags.",
  },
  instagram: {
    maxChars: 2200,
    style: "caption + 10-15 hashtags, emoji-friendly.",
  },
  threads: {
    maxChars: 500,
    style: "500 characters max, conversational.",
  },
};

function buildSystemPrompt(platforms, postType, tone, language) {
  const platformInstructions = platforms
    .map((p) => `- ${p}: ${PLATFORM_CONSTRAINTS[p]?.style || "standard format"}`)
    .join("\n");

  return `You are an expert social media content writer. Create platform-specific content.

Post type: ${postType}
Tone: ${tone}
Language: ${language}

Platform requirements:
${platformInstructions}

Respond ONLY with a valid JSON object with this exact structure:
{
  "platforms": {
    ${platforms.map((p) => `"${p}": { "content": "...", "hashtags": ["#tag1", "#tag2"] }`).join(",\n    ")}
  }
}

No markdown, no explanation—just the JSON.`;
}

function parseAIResponse(text, platforms) {
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.platforms || parsed;
  } catch {
    // Fallback: try to extract JSON object
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return parsed.platforms || parsed;
      } catch {
        // ignore
      }
    }
    // Return placeholder on parse failure
    const fallback = {};
    for (const p of platforms) {
      fallback[p] = { content: text.trim(), hashtags: [] };
    }
    return fallback;
  }
}

function buildResult(generated, platforms, modelName, tokensUsed) {
  const result = {};
  for (const platform of platforms) {
    const raw = generated[platform] || {};
    const content = raw.content || "";
    result[platform] = {
      content,
      char_count: content.length,
      hashtags: raw.hashtags || [],
    };
  }
  return { generated: result, model_used: modelName, tokens_used: tokensUsed };
}

export async function generateContent(userId, { idea, post_type, platforms, tone, language, model }) {
  // Get user's API keys, fall back to env keys
  const userKeys = await getDecryptedAiKeys(userId);

  const systemPrompt = buildSystemPrompt(platforms, post_type, tone, language);
  const userMessage = `Idea: ${idea}`;

  if (model === "openai") {
    const apiKey = userKeys.openai || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError(
        "No OpenAI API key configured. Add your key via PUT /api/user/ai-keys or set OPENAI_API_KEY in .env",
        422,
        "NO_API_KEY"
      );
    }

    const openai = new OpenAI({ apiKey });
    const modelName = process.env.OPENAI_MODEL || "gpt-4o";
    
    logger.info(`Calling OpenAI (model: ${modelName})`);

    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
    });

    const text = response.choices[0].message.content;
    const generated = parseAIResponse(text, platforms);
    return buildResult(generated, platforms, response.model, response.usage?.total_tokens || 0);
  }

  if (model === "anthropic") {
    const apiKey = userKeys.anthropic || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AppError(
        "No Anthropic API key configured. Add your key via PUT /api/user/ai-keys or set ANTHROPIC_API_KEY in .env",
        422,
        "NO_API_KEY"
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const modelName = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
    logger.info(`Calling Anthropic (model: ${modelName})`);

    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].text;
    const generated = parseAIResponse(text, platforms);
    return buildResult(
      generated,
      platforms,
      modelName,
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    );
  }

  throw new AppError("Invalid model. Use 'openai' or 'anthropic'", 400, "INVALID_MODEL");
}
