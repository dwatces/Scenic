import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import Hero from "../components/Hero";
import RecentScenes from "../components/RecentScenes";

/** The signed-out home page: the hero, then the newest scenes. */
const LandingPage = () => {
  useDocumentTitle("Scenic: share photos of the places you love", { full: true });
  return (
    <>
      <Hero />
      <RecentScenes />
    </>
  );
};

export default LandingPage;
