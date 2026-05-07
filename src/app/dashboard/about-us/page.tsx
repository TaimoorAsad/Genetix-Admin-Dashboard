"use client";

import AppContentEditor from "@/components/AppContentEditor";

export default function AboutUsPage() {
  return (
    <AppContentEditor
      section="about-us"
      title="About Us information"
      description="Manage content shown in the About Us tab in the app. Add text, image URLs, or YouTube/video links. Blocks are shown in order. If no content is set here, the app falls back to default About Us content."
    />
  );
}
