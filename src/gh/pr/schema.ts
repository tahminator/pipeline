import z from "zod";

/*
 * schema should match the values we need from the below snippet:
 *
 * ```yaml
 * apiVersion: kustomize.config.k8s.io/v1beta1
 * kind: Kustomization
 * resources:
 *   - deployment.yaml
 *   - secrets.yaml
 *   - service.yaml
 *   - monitor.yaml
 * commonLabels:
 *   app: instalock-web
 *   environment: production
 * images:
 *   - name: tahminator/instalock-web
 *     newTag: a70ee0e
 * ```
 */
export const kustomizeSchema = z.object({
  kind: z.literal("Kustomization"),
  images: z
    .array(
      z.object({
        name: z.string(),
        newTag: z.string(),
      }),
    )
    .optional(),
});
