import { useCallback } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import type { SelectChangeEvent } from '@mui/material/Select';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

import { useJobStore } from '@/store/useJobStore';



interface JobFiltersProps {
  onSearch: () => void;
  loading?: boolean;
}

function JobFilters({ onSearch, loading = false }: JobFiltersProps) {
  const searchQuery = useJobStore((s) => s.searchQuery);
  const setSearchQuery = useJobStore((s) => s.setSearchQuery);
  const resetFilters = useJobStore((s) => s.resetFilters);



  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        onSearch();
      }
    },
    [onSearch],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        alignItems: 'center',
        mb: 3,
      }}
    >
      <TextField
        placeholder="Search jobs (e.g. Software Engineer)"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={handleKeyPress}
        size="small"
        sx={{ minWidth: 280, flex: 1 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      

      

      <Button
        variant="contained"
        startIcon={<FilterListIcon />}
        onClick={onSearch}
        disabled={!searchQuery.trim() || loading}
      >
        Search
      </Button>

      <Button variant="text" size="small" onClick={resetFilters}>
        Reset
      </Button>
    </Box>
  );
}

export default JobFilters;
