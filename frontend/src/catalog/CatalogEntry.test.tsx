import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MvpApp from '../v2/MvpApp';

vi.mock('../v2/MvpMap', () => ({ MvpMap: () => <div>地图</div> }));
vi.mock('../v2/api', () => ({ api: vi.fn().mockResolvedValue({ deepseek_configured: true, amap_configured: true }) }));
it('opens a separate product index without replacing the planning page', () => {
  render(<MvpApp />);
  const entry = screen.getByRole('link', { name: '航空器产品' });
  expect(entry).toHaveAttribute('href', '/aircraft');
  expect(entry).toHaveAttribute('target', '_blank');
  expect(screen.getByRole('textbox', { name: '出行需求' })).toBeInTheDocument();
});
