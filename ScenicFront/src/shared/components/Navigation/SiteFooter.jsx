import "./SiteFooter.css";

const SOURCE = "https://github.com/dwatces/Scenic";

/** What Scenic is, who built it, and where the code lives. */
const SiteFooter = () => (
  <footer className="site-footer">
    <div className="site-footer__inner">
      <p className="site-footer__about">
        Scenic is a full-stack demo app: a React client and an Express and MongoDB API. Accounts and
        scenes marked “Demo” are sample content.
      </p>
      <p className="site-footer__credits">
        <span>Built by Daniel Olliver</span>
        <a href={SOURCE} rel="noopener noreferrer">
          Source code on GitHub
        </a>
      </p>
    </div>
  </footer>
);

export default SiteFooter;
