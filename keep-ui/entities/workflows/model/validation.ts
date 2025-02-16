import { Definition, V2Step } from "./types";

export type ValidationResult = [string, string];

export const PROVIDERS_WITH_NO_CONFIG = ["console", "bash"];

export function validateGlobalPure(definition: Definition): ValidationResult[] {
  const errors: ValidationResult[] = [];
  const workflowName = definition?.properties?.name;
  const workflowDescription = definition?.properties?.description;
  if (!workflowName) {
    errors.push(["workflow_name", "Workflow name cannot be empty."]);
  }
  if (!workflowDescription) {
    errors.push([
      "workflow_description",
      "Workflow description cannot be empty.",
    ]);
  }

  if (
    !!definition?.properties &&
    !definition.properties["manual"] &&
    !definition.properties["interval"] &&
    !definition.properties["alert"] &&
    !definition.properties["incident"]
  ) {
    errors.push([
      "trigger_start",
      "Workflow should have at least one trigger.",
    ]);
  }

  if (
    definition?.properties &&
    "interval" in definition.properties &&
    !definition.properties.interval
  ) {
    errors.push(["interval", "Workflow interval cannot be empty."]);
  }

  const alertSources = Object.values(definition.properties.alert || {}).filter(
    Boolean
  );
  if (
    definition?.properties &&
    definition.properties["alert"] &&
    alertSources.length == 0
  ) {
    errors.push(["alert", "Workflow alert trigger cannot be empty."]);
  }

  const incidentActions = Object.values(
    definition.properties.incident || {}
  ).filter(Boolean);
  if (
    definition?.properties &&
    definition.properties["incident"] &&
    incidentActions.length == 0
  ) {
    errors.push(["incident", "Workflow incident trigger cannot be empty."]);
  }

  const anyStepOrAction = definition?.sequence?.length > 0;
  if (!anyStepOrAction) {
    errors.push(["trigger_end", "At least 1 step/action is required."]);
  }
  const firstStep = definition?.sequence?.[0];
  const firstStepSequence =
    firstStep?.componentType === "container" ? firstStep.sequence : [];
  const anyActionsInMainSequence = firstStepSequence?.some((step) =>
    step?.type?.includes("action-")
  );
  if (anyActionsInMainSequence) {
    // This checks to see if there's any steps after the first action
    const actionIndex = firstStepSequence?.findIndex((step) =>
      step.type.includes("action-")
    );
    if (actionIndex && definition?.sequence) {
      const sequence = firstStepSequence;
      for (let i = actionIndex + 1; i < sequence.length; i++) {
        if (sequence[i]?.type?.includes("step-")) {
          errors.push([
            sequence[i].id,
            "Steps cannot be placed after actions.",
          ]);
        }
      }
    }
  }
  return errors;
}

export function validateStepPure(step: V2Step): string | null {
  if (step.type.includes("condition-")) {
    if (!step.name) {
      return "Step/action name cannot be empty.";
    }
    const branches =
      step?.componentType === "switch"
        ? step.branches
        : {
            true: [],
            false: [],
          };
    const onlyActions = branches?.true?.every((step: V2Step) =>
      step.type.includes("action-")
    );
    if (!onlyActions) {
      return "Conditions can only contain actions.";
    }
    const conditionHasActions = branches?.true
      ? branches?.true.length > 0
      : false;
    if (!conditionHasActions) {
      return "Conditions must contain at least one action.";
    }
    const valid = conditionHasActions && onlyActions;
    return valid ? null : "Conditions must contain at least one action.";
  }
  if (step?.componentType === "task") {
    if (!step?.name) {
      return "Step name cannot be empty.";
    }
    const providerType = step?.type.split("-")[1];
    const providerConfig = (step?.properties.config as string)?.trim();
    if (!providerConfig && !PROVIDERS_WITH_NO_CONFIG.includes(providerType)) {
      return "No provider selected";
    }
    if (
      !Object.values(step?.properties?.with || {}).some(
        (value) => String(value).length > 0
      )
    ) {
      return "No parameters configured";
    }
    return null;
  }
  return null;
}
