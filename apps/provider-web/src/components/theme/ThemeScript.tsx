// Runs before the page paints, so there's no flash of the wrong theme.
// The choice ("system", "light" or "dark") is kept per device in
// localStorage; "system" follows the device setting, live.
const script = `(function(){try{
var m=window.matchMedia('(prefers-color-scheme: dark)');
function apply(){var t=localStorage.getItem('sdmd-theme')||'system';
document.documentElement.classList.toggle('dark',t==='dark'||(t==='system'&&m.matches));}
apply();m.addEventListener('change',apply);window.addEventListener('sdmd-theme',apply);
}catch(e){}})();`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
