import { Hero } from "@/components/home/Hero";
import { HomeSections } from "@/components/home/HomeSections";
import { ShopByMaterial } from "@/components/home/ShopByMaterial";
import { ThreeWays } from "@/components/home/ThreeWays";
import { FeaturedPieces } from "@/components/home/FeaturedPieces";
import { ShopByCategory } from "@/components/home/ShopByCategory";
import { CraftStory } from "@/components/home/CraftStory";
import { Stats } from "@/components/home/Stats";
import { GlobalPresence } from "@/components/home/GlobalPresence";
import { Testimonials } from "@/components/home/Testimonials";
import { TradeEnquiryForm } from "@/components/forms/TradeEnquiryForm";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HomeSections
        sections={{
          materials: <ShopByMaterial />,
          channels: <ThreeWays />,
          featured: <FeaturedPieces />,
          categories: <ShopByCategory />,
          craft: <CraftStory />,
          stats: <Stats />,
          presence: <GlobalPresence />,
          testimonials: <Testimonials />,
          enquiry: (
            <section id="enquire" className="section bg-ink text-ivory">
              <div className="container-site grid gap-12 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  <p className="eyebrow mb-4 text-accent-light">Trade enquiry</p>
                  <h2 className="display-2">Tell us what you need to stock.</h2>
                  <p className="lede mt-6 text-ivory/70">
                    Wholesale, private label, export or import — share a few details and our trade desk will send a
                    line sheet and pricing linked to today’s metal rate.
                  </p>
                </div>
                <div className="lg:col-span-7">
                  <TradeEnquiryForm dark />
                </div>
              </div>
            </section>
          ),
        }}
      />
    </>
  );
}
