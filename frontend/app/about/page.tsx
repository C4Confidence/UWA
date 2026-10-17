import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Asterisk } from "lucide-react";

export const metadata: Metadata = {
  title: "Our story",
  description: "A fresh perspective on everyday living. Get to know UWA.",
  alternates: { canonical: "/about" },
};
export default function AboutPage() {
  return (
    <>
      <section className="about-hero page-wrap">
        <p className="eyebrow">A little about UWA</p>
        <h1>
          For all the things
          <br />
          that make you, <em>you.</em>
        </h1>
        <div className="about-hero-bottom">
          <p>
            We believe the everyday deserves a little more attention. The things
            you reach for. The spaces you make your own. The small discoveries
            that feel just right.
          </p>
          <Asterisk size={100} strokeWidth={0.8} />
        </div>
      </section>
      <section className="about-values section-wrap">
        <div>
          <p className="eyebrow">Our point of view</p>
          <h2>
            A good find is
            <br />a personal thing.
          </h2>
        </div>
        <div className="values-list">
          <article>
            <span>01</span>
            <div>
              <h3>Everyday, with intention.</h3>
              <p>
                We’re building a place for thoughtful discovery. A collection
                that helps you find the things that fit into your life.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Your own kind of good.</h3>
              <p>
                Different tastes. Different routines. Different ways of seeing
                the world. There’s room for yours here.
              </p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Clarity comes first.</h3>
              <p>
                Real product information and a clear shopping experience. We’ll
                always tell you when something isn’t available yet.
              </p>
            </div>
          </article>
        </div>
      </section>
      <section className="about-cta">
        <p className="eyebrow">Make a little discovery</p>
        <h2>
          Your everyday.
          <br />A fresh perspective.
        </h2>
        <Link href="/products" className="button button-dark">
          Explore the collection <ArrowUpRight size={19} />
        </Link>
      </section>
    </>
  );
}
