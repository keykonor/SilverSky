import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';
import MvpApp from './v2/MvpApp';
import CatalogPage from './catalog/CatalogPage';

const Page = new URLSearchParams(window.location.search).get('legacy') === '1' ? App : MvpApp;
const sitePath = '/' + window.location.pathname.slice(import.meta.env.BASE_URL.length);
const isCatalog = /^\/aircraft(?:\/|$)/.test(sitePath);
const productId = sitePath.split('/').filter(Boolean)[1];

function StaticPreview() {
  return <main className="v2-app">
    <header className="v2-header"><a className="v2-brand" href={import.meta.env.BASE_URL}>S<span>SilverSky <small>V3</small></span></a><span className="v2-service">静态展示</span><a className="v2-legacy" href={import.meta.env.BASE_URL + 'aircraft/'}>航空器产品</a></header>
    <section className="v2-input-panel" aria-labelledby="preview-title">
      <div className="v2-input-copy"><p>SilverSky AI</p><h1 id="preview-title">从一句话，开始这段旅程</h1>
        <span>面向老年用户的出行规划项目。完整应用提供文字与语音需求输入、高德地面道路参考和明确标注的模拟低空场景。</span>
        <p>此页面可浏览项目与航空器资料。在线路线查询、文字规划和三维场景需要运行后端。</p>
        <p><a href="https://github.com/keykonor/SilverSky">查看源码与运行说明</a> · <a href="https://github.com/keykonor/SilverSky/archive/refs/heads/main.zip">下载源码 ZIP</a></p>
      </div>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCatalog ? <CatalogPage productId={productId} /> : import.meta.env.MODE === 'pages' ? <StaticPreview /> : <Page />}
  </StrictMode>,
);
