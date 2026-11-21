import { z } from "zod";
import { parseBody, parseObjectId } from "../http/validation.js";
import { ADJUSTMENT_DIRECTIONS, MOVEMENT_TYPES } from "../models/constants.js";
import { isPositiveInteger } from "../models/validators.js";
import { listMovements, recordMovement } from "../services/movements.js";

const QUANTITY_MESSAGE = "Quantity must be a positive whole number.";
const TYPE_MESSAGE = `Movement type must be one of: ${MOVEMENT_TYPES.join(", ")}.`;

const createSchema = z.strictObject({
  productId: z.string({ error: "Product is required." }),
  type: z.enum(MOVEMENT_TYPES, { error: TYPE_MESSAGE }),
  quantity: z.number({ error: QUANTITY_MESSAGE })
    .refine((value) => isPositiveInteger(value) && Number.isSafeInteger(value), QUANTITY_MESSAGE),
  note: z.string({ error: "Note must be text." }).trim().optional(),
  direction: z.enum(ADJUSTMENT_DIRECTIONS, { error: "Direction must be in or out." }).optional(),
}).superRefine((value, context) => {
  if (value.type === "adjustment" && value.direction === undefined) {
    context.addIssue({ code: "custom", message: "Direction must be in or out for an adjustment." });
  }
  if (value.type !== "adjustment" && value.direction !== undefined) {
    context.addIssue({ code: "custom", message: "Direction is only allowed for an adjustment." });
  }
});

export const movementsController = {
  async listAll(req, res) {
    res.json({ movements: await listMovements() });
  },

  async listMine(req, res) {
    res.json({ movements: await listMovements({ userId: req.user.id }) });
  },

  async create(req, res) {
    const input = parseBody(createSchema, req.body);
    const productId = parseObjectId(input.productId, "Invalid product id.");
    const note = input.note ? input.note : undefined;
    const movement = await recordMovement(
      { ...input, productId, note },
      { actorId: req.user.id, actorRole: req.user.role },
    );
    res.status(201).json({ movement });
  },
};
