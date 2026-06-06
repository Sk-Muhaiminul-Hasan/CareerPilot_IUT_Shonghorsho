import React from 'react';
import { ListItemText, Menu, MenuItem } from '@mui/material';
import type { ContextOption } from './contextOptions';

interface AssistantContextMenuProps {
  anchorEl: HTMLElement | null;
  options: ContextOption[];
  onSelect: (option: ContextOption) => void;
  onClose: () => void;
}

export const AssistantContextMenu: React.FC<AssistantContextMenuProps> = ({
  anchorEl,
  options,
  onSelect,
  onClose,
}) => (
  <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
    {options.map((option) => (
      <MenuItem key={option.id} disabled={option.disabled} onClick={() => onSelect(option)}>
        <ListItemText primary={option.label} secondary={option.description} />
      </MenuItem>
    ))}
  </Menu>
);
