import { HttpError } from "./errors.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;

export function parseBody(schema, body) {
  const parsed = schema.safeParse(body ?? {});
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  if (issue.code === "unrecognized_keys" || issue.path.length === 0 && issue.code === "invalid_type") {
    throw new HttpError(400, "Invalid request.");
  }
  throw new HttpError(400, issue.message);
}

export function parseObjectId(value, message) {
  if (typeof value !== "string" || !OBJECT_ID.test(value)) throw new HttpError(400, message);
  return value.toLowerCase();
}
