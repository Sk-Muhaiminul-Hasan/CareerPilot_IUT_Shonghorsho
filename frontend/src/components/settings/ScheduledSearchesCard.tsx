import { useState, useCallback } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

import {
  useScheduledSearches,
  useCreateScheduledSearch,
  useUpdateScheduledSearch,
  useDeleteScheduledSearch,
} from '@/hooks/useScheduledSearches';
import type { ScheduledSearch, ScheduledSearchCreate } from '@/types/scheduledSearch';

const PLATFORMS = ['linkedin', 'indeed', 'glassdoor'];

function ScheduledSearchesCard() {
  const { data: searches = [], isLoading } = useScheduledSearches();
  const createMutation = useCreateScheduledSearch();
  const updateMutation = useUpdateScheduledSearch();
  const deleteMutation = useDeleteScheduledSearch();

  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([...PLATFORMS]);
  const [schedule, setSchedule] = useState('daily');
  const [error, setError] = useState<string | null>(null);

  const handlePlatformToggle = useCallback((platform: string, checked: boolean) => {
    setPlatforms((prev) =>
      checked ? [...prev, platform] : prev.filter((item) => item !== platform),
    );
  }, []);

  const handleCreate = useCallback(async () => {
    setError(null);
    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim() || null;

    const payload: ScheduledSearchCreate = {
      query: trimmedQuery,
      location: trimmedLocation,
      platforms: platforms.length ? platforms : ['linkedin'],
      schedule,
    };

    try {
      await createMutation.mutateAsync(payload);
      setQuery('');
      setLocation('');
      setPlatforms([...PLATFORMS]);
      setSchedule('daily');
    } catch (exc) {
      setError(
        exc instanceof Error
          ? exc.message
          : 'Failed to create scheduled search.',
      );
    }
  }, [query, location, platforms, schedule, createMutation]);

  const handleToggle = useCallback(
    async (search: ScheduledSearch) => {
      await updateMutation.mutateAsync({
        searchId: search.id,
        payload: { is_active: !search.is_active },
      });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    async (searchId: string) => {
      if (!window.confirm('Delete this scheduled search?')) {
        return;
      }
      await deleteMutation.mutateAsync(searchId);
    },
    [deleteMutation],
  );

  const isSubmitting = createMutation.isPending;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Scheduled Job Searches
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Automatically run saved searches on a schedule.
        </Typography>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
            <TextField
              label="Search query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              sx={{ flex: 2 }}
            />
            <TextField
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>

          <FormControl fullWidth>
            <InputLabel id="scheduled-search-schedule-label">Schedule</InputLabel>
            <Select
              labelId="scheduled-search-schedule-label"
              label="Schedule"
              value={schedule}
              onChange={(e: SelectChangeEvent) => setSchedule(e.target.value)}
            >
              {[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monday', label: 'Every Monday' },
                { value: 'wednesday', label: 'Every Wednesday' },
                { value: 'friday', label: 'Every Friday' },
              ].map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormGroup row>
            {PLATFORMS.map((platform) => (
              <FormControlLabel
                key={platform}
                control={
                  <Checkbox
                    checked={platforms.includes(platform)}
                    onChange={(e) => handlePlatformToggle(platform, e.target.checked)}
                  />
                }
                label={platform.charAt(0).toUpperCase() + platform.slice(1)}
              />
            ))}
          </FormGroup>

          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isSubmitting || !query.trim()}
          >
            {isSubmitting ? <CircularProgress size={20} /> : 'Add Scheduled Search'}
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Active Schedules
          </Typography>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : searches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No scheduled searches yet.
            </Typography>
          ) : (
            searches.map((search) => (
              <Box
                key={search.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  px: 2,
                  py: 1,
                  mb: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {search.query}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {search.schedule}
                    {search.location ? ` • ${search.location}` : ''}
                  </Typography>
                </Box>
                <Switch
                  checked={search.is_active}
                  onChange={() => handleToggle(search)}
                />
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(search.id)}
                  disabled={deleteMutation.isPending}
                >
                  <span style={{ fontSize: 18 }} aria-label="delete">
                    🗑
                  </span>
                </IconButton>
              </Box>
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default ScheduledSearchesCard;
