import React from 'react';
import { ListItemText, Menu, MenuItem } from '@mui/material';
import type { ContextOption } from './contextOptions';

interface MentionMenuProps {
  anchorEl: HTMLElement | null;
  query: string;
  options: ContextOption[];
  onSelect: (option: ContextOption) => void;
  onClose: () => void;
}

function matches(option: ContextOption, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${option.label} ${option.description} ${option.insertText}`.toLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export const MentionMenu: React.FC<MentionMenuProps> = ({
  anchorEl,
  query,
  options,
  onSelect,
  onClose,
}) => {
  const filtered = options.filter((option) => !option.disabled && matches(option, query)).slice(0, 6);

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl) && filtered.length > 0} onClose={onClose}>
      {filtered.map((option) => (
        <MenuItem key={option.id} onClick={() => onSelect(option)}>
          <ListItemText primary={`@${option.insertText}`} secondary={option.description} />
        </MenuItem>
      ))}
    </Menu>
  );
};
