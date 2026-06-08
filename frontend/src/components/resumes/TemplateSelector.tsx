import React, { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

import api from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

interface ApiTemplate {
  id: string;
  name: string;
  formats: string[];
}

interface TemplateSelectorProps {
  selectedId?: string;
  onSelect: (templateId: string) => void;
}

function TemplateSelector({ selectedId = 'modern', onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Dialog state for custom template name
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<ApiTemplate[]>('/resumes/templates');
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      useAppStore.getState().showNotification('Failed to load resume templates.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'html' && ext !== 'md' && ext !== 'docx') {
      useAppStore.getState().showNotification('Only .html, .md, or .docx templates are supported.', 'warning');
      return;
    }

    // Default template name based on file name (without extension)
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const formattedName = baseName.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    setPendingFile(file);
    setTemplateName(formattedName);
    setDialogOpen(true);
  };

  const handleUpload = async () => {
    if (!pendingFile || !templateName.trim()) return;

    setIsUploading(true);
    setDialogOpen(false);

    const formData = new FormData();
    formData.append('file', pendingFile);

    try {
      const { data } = await api.post<{ template_id: string; message: string }>(
        `/resumes/templates/upload?name=${encodeURIComponent(templateName.trim())}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      useAppStore.getState().showNotification(data.message || 'Template uploaded successfully!', 'success');
      
      // Refresh templates
      const { data: updatedTemplates } = await api.get<ApiTemplate[]>('/resumes/templates');
      setTemplates(updatedTemplates);
      
      // Auto-select the newly uploaded template
      if (data.template_id) {
        onSelect(data.template_id);
      }
    } catch (err: any) {
      console.error('Failed to upload template:', err);
      const detail = err.response?.data?.detail || err.message || 'Upload failed.';
      useAppStore.getState().showNotification(`Template upload failed: ${detail}`, 'error');
    } finally {
      setIsUploading(false);
      setPendingFile(null);
      setTemplateName('');
    }
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setPendingFile(null);
    setTemplateName('');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, alignItems: 'center', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">Loading templates...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={2}>
        {templates.map((template) => {
          const isSelected = selectedId === template.id;
          return (
            <Grid item xs={12} sm={6} md={4} lg={2.4} key={template.id}>
              <Card
                sx={{
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  borderWidth: isSelected ? 2 : 1,
                  borderStyle: 'solid',
                  position: 'relative',
                  boxShadow: isSelected ? '0 4px 12px rgba(25, 118, 210, 0.15)' : 'none',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                  '&:hover': {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    transform: 'translateY(-2px)',
                  }
                }}
              >
                <CardActionArea onClick={() => onSelect(template.id)}>
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    {isSelected && (
                      <CheckCircleIcon
                        color="primary"
                        sx={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    )}
                    <Box
                      sx={{
                        width: 60,
                        height: 80,
                        mx: 'auto',
                        mb: 1.5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: isSelected ? 'primary.light' : 'grey.100',
                        color: isSelected ? 'white' : 'grey.500',
                        borderRadius: 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <DescriptionIcon sx={{ fontSize: 32 }} />
                      <Typography variant="caption" sx={{ fontSize: '0.65rem', fontWeight: 700, mt: 0.5, textTransform: 'uppercase' }}>
                        {template.formats.join(' / ')}
                      </Typography>
                    </Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0b1c30' }}>
                      {template.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {template.id.startsWith('custom_') || !['modern', 'classic', 'minimal', 'technical', 'creative'].includes(template.id) ? 'Custom User Template' : 'Standard Pre-built'}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}

        {/* Upload Template Card */}
        <Grid item xs={12} sm={6} md={4} lg={2.4}>
          <Card
            sx={{
              borderColor: 'divider',
              borderWidth: 1,
              borderStyle: 'dashed',
              borderRadius: 2,
              minHeight: 168,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#fcfdff',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#f4f8ff',
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
              }
            }}
          >
            <CardActionArea component="label" disabled={isUploading}>
              <input
                type="file"
                hidden
                accept=".html,.md,.docx"
                onChange={handleFileChange}
              />
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                {isUploading ? (
                  <CircularProgress size={32} />
                ) : (
                  <CloudUploadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                )}
                <Typography variant="subtitle2" fontWeight={700} color="primary.main">
                  {isUploading ? 'Uploading...' : 'Upload Template'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Support .html, .md, .docx
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog to name the custom template */}
      <Dialog open={dialogOpen} onClose={handleCancel} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Name Your Template</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Give your newly uploaded template a friendly name.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Template Name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            variant="outlined"
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancel} color="inherit">Cancel</Button>
          <Button onClick={handleUpload} variant="contained" disabled={!templateName.trim()}>
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TemplateSelector;
