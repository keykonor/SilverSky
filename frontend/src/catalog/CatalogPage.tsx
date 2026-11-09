import { useEffect, useState } from 'react';
import productData from './products.json';
import { PRODUCT_NAME } from '../version';
import './catalog.css';

export type Product = typeof productData[number];
const products: Product[] = productData;
const companies = [...new Set(products.map((p) => p.company))];
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[\s_–-]+/g, '');
const designUrl = 'https://www.figma.com/design/hiQYqQgFzNgWf6Tpwvo7zl?node-id=6-180';
const emptyFilters = { query: '', category: 'all', region: 'all', autonomy: 'all', company: 'all' };
function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return { query: (params.get('q') ?? '').slice(0, 120),
    category: ['passenger', 'cargo'].includes(params.get('category') ?? '') ? params.get('category')! : 'all',
    region: ['domestic', 'international'].includes(params.get('region') ?? '') ? params.get('region')! : 'all',
    autonomy: ['autonomous', 'piloted'].includes(params.get('autonomy') ?? '') ? params.get('autonomy')! : 'all',
    company: companies.includes(params.get('company') ?? '') ? params.get('company')! : 'all' };
}
function ProductImage({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return <div className="cat-card-picture">{(failed || import.meta.env.MODE === 'pages')
    ? <span className="cat-image-failure">产品图片暂不可用</span>
    : <img src={import.meta.env.BASE_URL + product.image.slice(1)} alt={`${product.model} 官方产品图片`} onError={() => setFailed(true)} />}</div>;
}
function Header() {
  return <header className="cat-header"><a href={import.meta.env.BASE_URL} className="cat-brand"><span>S</span>SilverSky</a>
    <nav aria-label="主导航"><a href={import.meta.env.BASE_URL}>行程规划</a><a href={import.meta.env.BASE_URL + 'aircraft'} aria-current="page">航空器产品</a></nav></header>;
}
function RadioGroup({ title, name, value, options, onChange }: { title: string; name: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <fieldset><legend>{title}</legend>{options.map(([id, label]) => <label key={id}>
    <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} /><span>{label}</span>
  </label>)}</fieldset>;
}
function Tags({ product }: { product: Product }) {
  return <div className="cat-tags"><span>{product.category === 'cargo' ? '载物运输' : '载人出行'}</span>
    <span className={product.autonomy === 'piloted' ? 'cat-piloted' : ''}>{product.autonomy === 'piloted' ? '有人驾驶 eVTOL' : '无人驾驶'}</span></div>;
}
function ProductInfoCard({ product }: { product: Product }) {
  return <article className="cat-card"><a href={import.meta.env.BASE_URL + `aircraft/${product.id}`} aria-label={`查看 ${product.model} 产品详情`}>
    <ProductImage product={product} /><h2>{product.model}</h2><p className="cat-company">{product.company}</p><Tags product={product} />
    <dl className="cat-metrics">{product.metrics.map((metric) => <div key={metric.label} title={metric.note}><dd>{metric.value}</dd><dt>{metric.label}</dt></div>)}</dl>
    <div className="cat-card-bottom"><span>{product.availability}</span><strong>查看产品</strong></div>
  </a></article>;
}
function ProductDetail({ product }: { product: Product }) {
  return <><div className="cat-breadcrumb"><a href={import.meta.env.BASE_URL + 'aircraft'}>全部航空器</a><span>/</span><span>{product.model}</span></div>
    <div className="cat-detail"><ProductImage product={product} /><section className="cat-detail-heading"><Tags product={product} />
      <h1>{product.model}</h1><p className="cat-detail-company">{product.company} <span>{product.country}</span></p><p>{product.summary}</p>
      <dl className="cat-detail-facts"><div><dt>驾驶方式</dt><dd>{product.piloting}</dd></div><div><dt>公开状态</dt><dd>{product.availability}</dd></div><div><dt>资料核对</dt><dd>{product.checkedAt}</dd></div></dl>
      <a className="cat-official" href={product.sourceUrl} target="_blank" rel="noopener noreferrer">厂商产品资料</a>
    </section></div>
    <section className="cat-detail-section"><h2>主要性能与适用工况</h2><p>下列数值保留厂商口径；不同指标不默认可在同一任务中同时达到。</p>
      <div className="cat-spec-list">{product.metrics.map((metric) => <div key={metric.label}><h3>{metric.label}</h3><strong>{metric.value}</strong><p>{metric.note}</p></div>)}</div>
    </section>
    <section className="cat-detail-section cat-source"><h2>产品状态与资料来源</h2><p>{product.statusNote}</p>
      <ul><li><a href={product.sourceUrl} target="_blank" rel="noopener noreferrer">官方产品页或技术手册</a></li>
        {product.extraSources.map((url, i) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">官方补充资料 {i + 1}</a></li>)}
        <li><a href={product.imageSource} target="_blank" rel="noopener noreferrer">官方原图</a></li></ul>
      <p>{product.imageCredit}。公开产品资料（PUBLIC_DATA），不表示独立实测或航空运营批准。</p>
    </section></>;
}
export default function CatalogPage({ productId }: { productId?: string }) {
  const [filters, setFilters] = useState(initialFilters);
  const [mobileFilters, setMobileFilters] = useState(false);
  const product = productId ? products.find((p) => p.id === productId) : null;
  useEffect(() => {
    const previous = document.title;
    document.title = `${product?.model ?? '航空器产品库'} · ${PRODUCT_NAME}`;
    return () => { document.title = previous; };
  }, [product]);
  useEffect(() => {
    if (productId) return;
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(filters)) if (value && value !== 'all') params.set(name === 'query' ? 'q' : name, value);
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`);
  }, [filters, productId]);
  const filtered = products.filter((p) => (filters.category === 'all' || p.category === filters.category)
    && (filters.region === 'all' || (p.country === '中国') === (filters.region === 'domestic'))
    && (filters.autonomy === 'all' || p.autonomy === filters.autonomy)
    && (filters.company === 'all' || p.company === filters.company)
    && normalize(`${p.model} ${p.company}`).includes(normalize(filters.query)));
  const change = (key: keyof typeof filters, value: string) => setFilters((old) => ({ ...old, [key]: value }));
  return <div className="cat-shell"><a className="cat-skip" href="#catalog-content">跳到产品内容</a><Header />
    <main id="catalog-content">{productId ? product ? <ProductDetail key={product.id} product={product} /> : <section className="cat-empty"><h1>未找到该产品</h1><p>产品编号可能不正确，请返回索引重新选择。</p><a href={import.meta.env.BASE_URL + 'aircraft'}>返回产品索引</a></section> : <>
      <section className="cat-intro"><div><h1>航空器产品库</h1><p>从载人出行到空中物流，了解真实机型与公开性能。</p><small>国内为主，补充国外代表型号 · 资料核对 2026.11.06</small></div>
        <div className="cat-counts"><strong>{products.length} 款代表机型</strong><span>{products.filter((p) => p.country === '中国').length} 款国内 · {products.filter((p) => p.country !== '中国').length} 款国外</span></div></section>
      <p className="cat-notice">公开产品资料；研发状态与驾驶方式单独标注。性能有工况限制，收录不代表可预订或可执行航线。</p>
      <button className="cat-mobile-filter-toggle" aria-expanded={mobileFilters} aria-controls="catalog-filters" onClick={() => setMobileFilters((open) => !open)}>筛选产品 <span>{mobileFilters ? '收起' : '展开'}</span></button>
      <div className="cat-matrix"><aside id="catalog-filters" className={`cat-filters ${mobileFilters ? 'cat-filters-open' : ''}`} aria-label="产品筛选"><h2>筛选产品</h2>
        <RadioGroup title="用途" name="category" value={filters.category} options={[[ 'all', '全部机型' ],[ 'passenger', '载人出行' ],[ 'cargo', '载物运输' ]]} onChange={(value) => change('category', value)} />
        <RadioGroup title="产地" name="region" value={filters.region} options={[[ 'all', '全部地区' ],[ 'domestic', '国内' ],[ 'international', '国外' ]]} onChange={(value) => change('region', value)} />
        <RadioGroup title="驾驶方式" name="autonomy" value={filters.autonomy} options={[[ 'all', '全部方式' ],[ 'autonomous', '无人驾驶' ],[ 'piloted', '有人驾驶 eVTOL' ]]} onChange={(value) => change('autonomy', value)} />
        <div className="cat-company-filter"><label htmlFor="catalog-company">生产公司</label><select id="catalog-company" value={filters.company} onChange={(e) => change('company', e.target.value)}><option value="all">全部生产公司</option>{companies.map((company) => <option key={company}>{company}</option>)}</select></div>
        <button className="cat-clear" onClick={() => setFilters(emptyFilters)}>清除全部筛选</button>
      </aside><section className="cat-results" aria-label="航空器产品列表"><div className="cat-toolbar"><label><span className="cat-sr">搜索型号或生产公司</span><input type="search" maxLength={120} value={filters.query} onChange={(e) => change('query', e.target.value)} placeholder="搜索型号或生产公司" /></label><p role="status">显示 {filtered.length} / {products.length} 款</p></div>
        {filtered.length ? <div className="cat-grid">{filtered.map((p) => <ProductInfoCard key={p.id} product={p} />)}</div>
          : <div className="cat-empty"><h2>没有找到符合条件的产品</h2><p>试试其他型号、公司名称，或清除左侧筛选。</p></div>}
      </section></div></>}
    </main><footer className="cat-footer"><p>参数与图片来自厂商公开资料，图片版权归原权利人。不同型号的最大载荷与最大航程不默认同时可达。</p><p>首批代表型号索引，非全市场清单。<a href={designUrl} target="_blank" rel="noopener noreferrer">查看 Figma 页面设计</a></p></footer>
  </div>;
}
