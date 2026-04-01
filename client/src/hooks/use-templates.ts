import { useEffect, useState } from "react";
import {
  createTemplateFromDraft,
  duplicateTemplate,
  loadTemplatesFromStorage,
  persistTemplatesToStorage,
  updateTemplateFromDraft,
  type ProposalTemplate,
  type TemplateDraftInput
} from "@/lib/templates";

export function useTemplates() {
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadedTemplates = loadTemplatesFromStorage();
    setTemplates(loadedTemplates);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    persistTemplatesToStorage(templates);
  }, [templates, loading]);

  function createTemplate(draft: TemplateDraftInput) {
    const createdTemplate = createTemplateFromDraft(draft);
    setTemplates((current) => [createdTemplate, ...current]);
    return createdTemplate;
  }

  function updateTemplate(templateId: string, draft: TemplateDraftInput) {
    const sourceTemplate = templates.find((template) => template.id === templateId);
    if (!sourceTemplate) {
      return null;
    }

    const updatedTemplate = updateTemplateFromDraft(sourceTemplate, draft);
    setTemplates((current) =>
      current.map((template) => (template.id === templateId ? updatedTemplate : template))
    );
    return updatedTemplate;
  }

  function duplicateExistingTemplate(templateId: string) {
    const sourceTemplate = templates.find((template) => template.id === templateId);
    if (!sourceTemplate) {
      return null;
    }

    const duplicatedTemplate = duplicateTemplate(sourceTemplate);
    setTemplates((current) => [duplicatedTemplate, ...current]);
    return duplicatedTemplate;
  }

  function removeTemplate(templateId: string) {
    setTemplates((current) => current.filter((template) => template.id !== templateId));
  }

  return {
    templates,
    loading,
    createTemplate,
    updateTemplate,
    duplicateTemplate: duplicateExistingTemplate,
    removeTemplate
  };
}
