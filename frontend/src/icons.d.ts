declare module '@mui/icons-material' {
  import { SvgIconComponent } from '@mui/material';
  const component: SvgIconComponent;
  export default component;
}

declare module '@mui/icons-material/*' {
  import { SvgIconComponent } from '@mui/material';
  const component: SvgIconComponent;
  export default component;
}
