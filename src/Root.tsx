import { Composition } from "remotion";
import Sample from "./videos/sample";
import TestClip from "./videos/test-clip/index";
import DesignShowcase from "./videos/design-showcase/index";
import ReferenceShowcase from "./videos/reference-showcase/index";
import OrganicAffiliateMarketing from "./videos/organic-affiliate-marketing";
import CorporateCareerGrowthAmanaPremium916 from "./videos/corporate-career-growth-amana-premium-916/index";
import CorporateCareerGrowthAmana from "./videos/corporate-career-growth-amana/index";
import CorporateCareerGrowthAmana169 from "./videos/corporate-career-growth-amana-169";
import CorporateCareerGrowthAmanaReference from "./videos/corporate-career-growth-amana-reference-916";

const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Sample"
        component={Sample}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="TestClip"
        component={TestClip}
        durationInFrames={186}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DesignShowcase-916"
        component={DesignShowcase}
        durationInFrames={450}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DesignShowcase-169"
        component={DesignShowcase}
        durationInFrames={450}
        fps={25.71}
        width={1920}
        height={1080}
      />
      <Composition
        id="ReferenceShowcase-916"
        component={ReferenceShowcase}
        durationInFrames={510}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ReferenceShowcase-169"
        component={ReferenceShowcase}
        durationInFrames={510}
        fps={25.71}
        width={1920}
        height={1080}
      />
      <Composition
        id="OrganicAffiliateMarketing-916"
        component={OrganicAffiliateMarketing}
        durationInFrames={1914}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CorporateCareerGrowthAmana-Premium-916"
        component={CorporateCareerGrowthAmanaPremium916}
        durationInFrames={513}
        fps={23.976}
        width={1080}
        height={1920}
      />
      <Composition
        id="CorporateCareerGrowthAmana-916"
        component={CorporateCareerGrowthAmana}
        durationInFrames={513}
        fps={23.976}
        width={1080}
        height={1920}
      />
      <Composition
        id="CorporateCareerGrowthAmana-169"
        component={CorporateCareerGrowthAmana169}
        durationInFrames={513}
        fps={23.976}
        width={1920}
        height={1080}
      />
      <Composition
        id="CorporateCareerGrowthAmana-Reference-916"
        component={CorporateCareerGrowthAmanaReference}
        durationInFrames={513}
        fps={23.976}
        width={1080}
        height={1920}
      />
    </>
  );
};

export default Root;
