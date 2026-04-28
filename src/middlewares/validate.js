// Joi validation middleware factory
import Joi from "joi";

/**
 * Returns a middleware that validates req.body against a Joi schema.
 * Attaches validated data to req.body (strips unknown keys).
 */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      error.isJoi = true;
      return next(error);
    }
    req.body = value;
    next();
  };
}

// ──────────────────────────────────────────────
// Reusable schemas
// ──────────────────────────────────────────────

export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().min(1).max(255).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(1).max(255),
    bio: Joi.string().max(500).allow(""),
    default_tone: Joi.string().valid("professional", "casual", "witty", "authoritative", "friendly"),
    default_language: Joi.string().max(10),
  }).min(1),

  connectSocialAccount: Joi.object({
    platform: Joi.string().valid("twitter", "linkedin", "instagram", "threads").required(),
    handle: Joi.string().required(),
    access_token: Joi.string().required(),
    refresh_token: Joi.string().allow("").optional(),
  }),

  storeAiKeys: Joi.object({
    openai_key: Joi.string().allow("").optional(),
    anthropic_key: Joi.string().allow("").optional(),
  }).or("openai_key", "anthropic_key"),

  generateContent: Joi.object({
    idea: Joi.string().max(500).required(),
    post_type: Joi.string()
      .valid("announcement", "thread", "story", "promotional", "educational", "opinion")
      .required(),
    platforms: Joi.array()
      .items(Joi.string().valid("twitter", "linkedin", "instagram", "threads"))
      .min(1)
      .required(),
    tone: Joi.string()
      .valid("professional", "casual", "witty", "authoritative", "friendly")
      .required(),
    language: Joi.string().default("en"),
    model: Joi.string().valid("openai", "anthropic").required(),
  }),

  publishPost: Joi.object({
    idea: Joi.string().max(500).required(),
    post_type: Joi.string()
      .valid("announcement", "thread", "story", "promotional", "educational", "opinion")
      .required(),
    platforms: Joi.array()
      .items(Joi.string().valid("twitter", "linkedin", "instagram", "threads"))
      .min(1)
      .required(),
    tone: Joi.string()
      .valid("professional", "casual", "witty", "authoritative", "friendly")
      .required(),
    language: Joi.string().default("en"),
    model: Joi.string().valid("openai", "anthropic").required(),
  }),

  schedulePost: Joi.object({
    idea: Joi.string().max(500).required(),
    post_type: Joi.string()
      .valid("announcement", "thread", "story", "promotional", "educational", "opinion")
      .required(),
    platforms: Joi.array()
      .items(Joi.string().valid("twitter", "linkedin", "instagram", "threads"))
      .min(1)
      .required(),
    tone: Joi.string()
      .valid("professional", "casual", "witty", "authoritative", "friendly")
      .required(),
    language: Joi.string().default("en"),
    model: Joi.string().valid("openai", "anthropic").required(),
    publish_at: Joi.string().isoDate().required(),
  }),
};
