import Image from "next/image";

// The web version of a mobile app's launch screen: every fresh open of the app,
// signed in or not and on any page, shows the logo for about a second. A fresh
// open is a new tab or browser session; moving around or refreshing doesn't
// count, and neither does coming back to a tab that's still open.
const SPLASH_MS = 1000;
const script = `(function(){var d=document.documentElement;
function done(){d.classList.add('launched')}
try{if(sessionStorage.getItem('sdm_launched'))return done();sessionStorage.setItem('sdm_launched','1')}catch(e){}
setTimeout(done,${SPLASH_MS});
})();`;

// Runs before the page paints, so a page that skips the splash never flashes it.
export function LaunchSplashScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export default function LaunchSplash() {
  return (
    <div id="launch-splash" aria-hidden className="fixed inset-0 z-[600] grid place-items-center overflow-hidden bg-surface px-6">
      <noscript><style>{"#launch-splash{display:none}"}</style></noscript>
      <div className="w-[280px] max-w-full animate-reveal text-center motion-reduce:animate-none">
        <Image src="/logo.png" alt="" width={280} height={112} loading="eager" className="h-auto w-full dark:hidden" />
        <Image src="/logo-white.png" alt="" width={280} height={112} loading="eager" className="hidden h-auto w-full dark:block" />
        <p className="-mt-1 text-ds-control text-muted">Healthcare, Closer to you</p>
      </div>
    </div>
  );
}
