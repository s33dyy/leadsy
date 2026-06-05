// Re-export the shared workflow catalog for app UI and API consumers.
export {
  automationWorkflowDefinitions,
  n8nProviderConfigByWorkflowKey,
  n8nProviderConfigGroups,
  providerConfigKeysForWorkflow,
  workflowDefinitionForKey,
  type AutomationWorkflowDefinition,
  type AutomationWorkflowKey,
  type N8nProviderConfigField,
  type N8nProviderConfigGroup,
  type N8nProviderConfigKey
} from "@leadsy/workflows";
