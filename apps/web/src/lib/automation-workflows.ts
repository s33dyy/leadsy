// Re-export the shared workflow catalog for app UI and API consumers.
export {
  automationWorkflowDefinitions,
  logicModuleForWorkflow,
  n8nBackendLogicByWorkflowKey,
  n8nBackendLogicModules,
  n8nProviderConfigByWorkflowKey,
  n8nProviderConfigGroups,
  providerConfigKeysForWorkflow,
  workflowDefinitionForKey,
  type AutomationWorkflowDefinition,
  type AutomationWorkflowKey,
  type N8nBackendLogicModule,
  type N8nLogicAction,
  type N8nLogicEditSurface,
  type N8nProviderConfigField,
  type N8nProviderConfigGroup,
  type N8nProviderConfigKey
} from "@leadsy/workflows";
