import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import CatalogPage from './CatalogPage';

afterEach(() => { cleanup(); window.history.replaceState(null, '', '/aircraft'); });
it('combines cargo, origin and company filters rather than silently resetting earlier choices', () => {
  render(<CatalogPage />);
  fireEvent.click(screen.getByLabelText('载物运输'));
  fireEvent.click(screen.getByLabelText('国内'));
  fireEvent.change(screen.getByLabelText('生产公司'), { target: { value: '大疆创新 DJI' } });
  expect(screen.getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('heading', { name: 'DJI FlyCart 100' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'EH216-S' })).not.toBeInTheDocument();
});
it('searches model/company, has a useful empty state and resets filters', () => {
  render(<CatalogPage />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-a-model' } });
  expect(screen.getByText('没有找到符合条件的产品')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '清除全部筛选' }));
  expect(screen.getAllByRole('article')).toHaveLength(12);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'eh216-s' } });
  expect(screen.getAllByRole('article')).toHaveLength(1);
});
it('shows piloted products separately and does not describe them as pilotless', () => {
  render(<CatalogPage />);
  fireEvent.click(screen.getByLabelText('有人驾驶 eVTOL'));
  expect(screen.getAllByRole('article')).toHaveLength(3);
  expect(screen.getByRole('heading', { name: 'AE200' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'VT35' })).not.toBeInTheDocument();
});
it('product details retain the exact load/range condition and manufacturer source', () => {
  render(<CatalogPage productId="fc100" />);
  expect(screen.getByRole('heading', { level: 1, name: 'DJI FlyCart 100' })).toBeInTheDocument();
  expect(screen.getByText(/不是85kg载荷下的保证航程/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '厂商产品资料' })).toHaveAttribute('href', 'https://www.dji.com/flycart-100');
});
it('unknown product does not fall back to an unrelated model', () => {
  render(<CatalogPage productId="unknown" />);
  expect(screen.getByRole('heading', { name: '未找到该产品' })).toBeInTheDocument();
});
it('failed product image has an honest fallback without substituting another aircraft', () => {
  render(<CatalogPage productId="eh216s" />);
  fireEvent.error(screen.getByAltText('EH216-S 官方产品图片'));
  expect(screen.getByText('产品图片暂不可用')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '厂商产品资料' })).toBeInTheDocument();
});
