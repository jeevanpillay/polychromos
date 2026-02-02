// Zod validators for runtime schema validation
import { z } from "zod";

const UniformValueSchema = z.union([
  z.number(),
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
  z.string(),
  z.boolean(),
]);

const LayoutConfigSchema = z.object({
  display: z.enum(["flex", "grid", "block"]).optional(),
  flexDirection: z.enum(["row", "column"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  gap: z.number().optional(),
  gridTemplateColumns: z.string().optional(),
  gridTemplateRows: z.string().optional(),
});

const TextConfigSchema = z.object({
  content: z.string(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.union([z.number(), z.string()]).optional(),
  lineHeight: z.union([z.number(), z.string()]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
});

const ImageConfigSchema = z.object({
  src: z.string().url(),
  alt: z.string().optional(),
  objectFit: z.enum(["cover", "contain", "fill"]).optional(),
});

const WebGLConfigSchema = z.object({
  shaderPath: z.string(),
  uniforms: z.record(z.string(), UniformValueSchema).optional(),
});

const PolychromosElementSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    type: z.enum(["box", "text", "image", "webgl"]),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.union([z.number(), z.string()]).optional(),
    height: z.union([z.number(), z.string()]).optional(),
    layout: LayoutConfigSchema.optional(),
    padding: z.union([
      z.number(),
      z.tuple([z.number(), z.number()]),
      z.tuple([z.number(), z.number(), z.number(), z.number()]),
    ]).optional(),
    margin: z.union([
      z.number(),
      z.tuple([z.number(), z.number()]),
      z.tuple([z.number(), z.number(), z.number(), z.number()]),
    ]).optional(),
    style: z.object({
      backgroundColor: z.string().optional(),
      borderRadius: z.number().optional(),
      border: z.string().optional(),
      opacity: z.number().optional(),
    }).optional(),
    text: TextConfigSchema.optional(),
    image: ImageConfigSchema.optional(),
    webgl: WebGLConfigSchema.optional(),
    children: z.array(PolychromosElementSchema).optional(),
  })
);

export const PolychromosComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  root: PolychromosElementSchema,
});

export const PolychromosWorkspaceSchema = z.object({
  id: z.string(),
  version: z.literal("1.0"),
  name: z.string(),
  settings: z.object({
    defaultUnits: z.enum(["px", "rem"]).optional(),
    rootFontSize: z.number().optional(),
  }).optional(),
  tokens: z.object({
    colors: z.record(z.string(), z.string()).optional(),
    spacing: z.record(z.string(), z.string()).optional(),
    fonts: z.record(z.string(), z.object({ family: z.string() })).optional(),
  }).optional(),
  components: z.record(z.string(), PolychromosComponentSchema),
});

export type ValidatorOptions = {
  allowUnknown?: boolean;
};
