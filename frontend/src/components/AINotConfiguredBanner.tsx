import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

interface AINotConfiguredBannerProps {
  message?: string;
}

function AINotConfiguredBanner({ message = 'Configure your AI model to unlock this feature.' }: AINotConfiguredBannerProps) {
  const navigate = useNavigate();

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2,
      borderRadius: 2,
      background: '#FAEEDA',
      border: '1px solid #F0C070',
      mb: 2,
    }}>
      <Typography variant="body2" sx={{ color: '#854F0B', flex: 1 }}>
        {message}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        onClick={() => navigate('/settings')}
        sx={{ color: '#854F0B', borderColor: '#854F0B', whiteSpace: 'nowrap' }}
      >
        Set up AI →
      </Button>
    </Box>
  );
}

export default AINotConfiguredBanner;
