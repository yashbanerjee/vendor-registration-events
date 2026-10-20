export function isEditable(fieldId: string, editableFieldIds?: string[], disabled?: boolean) {
  if (disabled) return false;
  if (!editableFieldIds) return true;
  return editableFieldIds.includes(fieldId);
}
