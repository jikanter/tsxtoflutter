/**
 * Zod schema mirroring `types.ts`. Used to validate IR JSON at the seam between
 * the TSX ingest package and the Dart codegen — if the schema drifts, both
 * sides break loudly instead of silently.
 */
import { z } from 'zod';

export const SourceLocSchema = z.object({
  file: z.string(),
  line: z.number().int().nonnegative(),
  col: z.number().int().nonnegative(),
});

export const SemanticTagSchema = z.enum([
  'stack',
  'box',
  'text',
  'text-inline',
  'image',
  'icon',
  'button',
  'link',
  'input',
  'textarea',
  'card',
  'divider',
  'list',
  'list-item',
  'avatar',
  'badge',
  'dialog',
  'sheet',
  'tabs',
  'tab',
  'fragment',
  'unknown',
]);

export const LengthSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('token'), path: z.string() }),
  z.object({ kind: z.enum(['px', 'rem', 'em', '%']), value: z.number() }),
  z.object({ kind: z.literal('auto') }),
]);

export const ColorRefSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('token'), path: z.string() }),
  z.object({ kind: z.literal('literal'), value: z.string() }),
]);

export const EdgeInsetsSchema = z.object({
  top: LengthSchema.optional(),
  right: LengthSchema.optional(),
  bottom: LengthSchema.optional(),
  left: LengthSchema.optional(),
  x: LengthSchema.optional(),
  y: LengthSchema.optional(),
});

export const RadiusSchema = z.object({
  tl: LengthSchema.optional(),
  tr: LengthSchema.optional(),
  bl: LengthSchema.optional(),
  br: LengthSchema.optional(),
  all: LengthSchema.optional(),
});

export const BorderSchema = z.object({
  width: LengthSchema.optional(),
  color: ColorRefSchema.optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

export const ShadowSchema = z.object({
  x: LengthSchema,
  y: LengthSchema,
  blur: LengthSchema,
  spread: LengthSchema.optional(),
  color: ColorRefSchema,
});

const NormalizedStyleSchemaBase = z.object({
  layout: z
    .object({
      display: z.enum(['flex', 'grid', 'block']).optional(),
      direction: z.enum(['row', 'col']).optional(),
      gap: LengthSchema.optional(),
      align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
      justify: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional(),
      wrap: z.boolean().optional(),
    })
    .optional(),
  box: z
    .object({
      width: LengthSchema.optional(),
      height: LengthSchema.optional(),
      minW: LengthSchema.optional(),
      maxW: LengthSchema.optional(),
      minH: LengthSchema.optional(),
      maxH: LengthSchema.optional(),
      padding: EdgeInsetsSchema.optional(),
      margin: EdgeInsetsSchema.optional(),
      radius: RadiusSchema.optional(),
      border: BorderSchema.optional(),
      shadow: z.array(ShadowSchema).optional(),
      opacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  color: z
    .object({
      bg: ColorRefSchema.optional(),
      fg: ColorRefSchema.optional(),
    })
    .optional(),
  text: z
    .object({
      font: z
        .object({
          family: z.string().optional(),
          tokenPath: z.string().optional(),
        })
        .optional(),
      size: LengthSchema.optional(),
      weight: z.number().optional(),
      lineHeight: LengthSchema.optional(),
      letterSpacing: LengthSchema.optional(),
      align: z.enum(['left', 'center', 'right', 'justify']).optional(),
    })
    .optional(),
});

export const NormalizedStyleSchema: z.ZodType = NormalizedStyleSchemaBase.extend({
  variants: z
    .array(
      z.object({
        selector: z.string(),
        style: z.lazy(() => NormalizedStyleSchema),
      }),
    )
    .optional(),
});

export const IRPropValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('literal'),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
  z.object({ kind: z.literal('paramRef'), name: z.string() }),
  z.object({
    kind: z.literal('memberRef'),
    object: z.string(),
    path: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('expression'),
    raw: z.string(),
    loc: SourceLocSchema.optional(),
  }),
]);

export const IREventHandlerSchema = z.object({
  name: z.string(),
  handler: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('paramRef'), name: z.string() }),
    z.object({
      kind: z.literal('expression'),
      raw: z.string(),
      loc: SourceLocSchema.optional(),
    }),
  ]),
});

export const UnsupportedMarkerSchema = z.object({
  feature: z.string(),
  loc: SourceLocSchema.optional(),
  message: z.string().optional(),
});

const IRNodeSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion('kind', [
    IRElementSchema,
    IRTextSchema,
    IRExpressionSchema,
    IRConditionalSchema,
    IRListSchema,
    IRFragmentSchema,
    IRSlotSchema,
  ]),
);

const IRElementSchema = z.object({
  kind: z.literal('element'),
  tag: SemanticTagSchema,
  source: z.object({ name: z.string(), loc: SourceLocSchema }),
  style: NormalizedStyleSchema,
  props: z.record(IRPropValueSchema),
  events: z.array(IREventHandlerSchema),
  children: z.array(IRNodeSchema),
  unsupported: z.array(UnsupportedMarkerSchema).optional(),
});

const IRTextSchema = z.object({
  kind: z.literal('text'),
  value: z.string(),
  loc: SourceLocSchema.optional(),
});

const IRExpressionSchema = z.object({
  kind: z.literal('expression'),
  expr: IRPropValueSchema,
  loc: SourceLocSchema.optional(),
});

const IRConditionalSchema = z.object({
  kind: z.literal('conditional'),
  test: IRPropValueSchema,
  consequent: IRNodeSchema,
  alternate: IRNodeSchema.optional(),
});

const IRListSchema = z.object({
  kind: z.literal('list'),
  items: IRPropValueSchema,
  itemBinding: z.string(),
  indexBinding: z.string().optional(),
  body: IRNodeSchema,
});

const IRFragmentSchema = z.object({
  kind: z.literal('fragment'),
  children: z.array(IRNodeSchema),
});

const IRSlotSchema = z.object({
  kind: z.literal('slot'),
  name: z.string(),
  children: z.array(IRNodeSchema),
});

export const IRTypeSchema: z.ZodType = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('string') }),
    z.object({ kind: z.literal('number') }),
    z.object({ kind: z.literal('boolean') }),
    z.object({ kind: z.literal('callback') }),
    z.object({ kind: z.literal('node') }),
    z.object({ kind: z.literal('array'), of: IRTypeSchema }),
    z.object({ kind: z.literal('union'), of: z.array(IRTypeSchema) }),
    z.object({ kind: z.literal('unknown') }),
  ]),
);

export const IRComponentParamSchema = z.object({
  name: z.string(),
  type: IRTypeSchema,
  optional: z.boolean().optional(),
  defaultValue: IRPropValueSchema.optional(),
});

export const IRStateDeclSchema = z.object({
  kind: z.enum(['state', 'reducer', 'effect', 'context', 'memo']),
  name: z.string(),
  initial: IRPropValueSchema.optional(),
  deps: z.array(IRPropValueSchema).optional(),
  body: z
    .object({
      raw: z.string(),
      loc: SourceLocSchema.optional(),
    })
    .optional(),
});

export const IRComponentSchema = z.object({
  kind: z.literal('component'),
  id: z.string(),
  name: z.string(),
  source: SourceLocSchema,
  params: z.array(IRComponentParamSchema),
  body: IRNodeSchema,
  state: z.array(IRStateDeclSchema).optional(),
});

export const IRDiagnosticSchema = z.object({
  severity: z.enum(['info', 'warn', 'error']),
  code: z.string(),
  message: z.string(),
  loc: SourceLocSchema.optional(),
});

export const IRProgramSchema = z.object({
  version: z.literal('0.1'),
  inputHash: z.string(),
  rulesetVersion: z.string(),
  components: z.array(IRComponentSchema),
  diagnostics: z.array(IRDiagnosticSchema),
});

export type IRProgramParsed = z.infer<typeof IRProgramSchema>;
