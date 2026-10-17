import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Asterisk,
  MoveUpRight,
} from "lucide-react";
import { FeaturedCollection } from "@/components/catalog";

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> A little more everyday extraordinary
          </p>
          <h1>
            Good finds.
            <br />
            Great <span>living.</span>
            <svg
              className="hero-underline"
              viewBox="0 0 350 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 13C79 0 211 0 345 8M44 17C170 5 257 7 329 14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </h1>
          <p className="hero-description">
            For the things you love.
            <br />
            And the life you’re making your own.
          </p>
          <Link href="/products" className="button button-dark hero-button">
            Explore the collection <ArrowUpRight size={20} />
          </Link>
          <div className="hero-footnote">
            <span className="mini-mark">u.</span>
            <span>
              Thoughtfully found.
              <br />
              <strong>Uniquely you.</strong>
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-orbit" />
          <span className="art-index">THE UWA PERSPECTIVE — 001</span>
          <span className="art-letter" aria-hidden="true">
            u.
          </span>
          <Image
            className="hero-headphones"
            src="/editorial/headphones.jpg"
            alt="Editorial inspiration: over-ear headphones"
            width={680}
            height={680}
            priority
            sizes="(max-width: 700px) 85vw, 45vw"
          />
          <div className="hero-stamp">
            <Asterisk size={29} strokeWidth={1.1} />
            <span>
              MADE FOR
              <br />
              YOUR EVERYDAY
            </span>
          </div>
          <div className="hero-art-caption">
            <span>Turn up the everyday.</span>
            <ArrowUpRight size={23} />
          </div>
          <span className="editorial-label">
            Editorial inspiration · explore current availability in the
            collection
          </span>
        </div>
        <a
          href="#the-collection"
          className="hero-scroll"
          aria-label="Scroll to the collection"
        >
          <ArrowDown size={17} />
        </a>
      </section>
      <div className="manifesto-strip">
        <span>Not just things.</span>
        <Asterisk />
        <span>Your kind of things.</span>
        <Asterisk />
        <span>Make the everyday yours.</span>
        <Asterisk />
        <span>Not just things.</span>
      </div>
      <FeaturedCollection />
      <section className="section-wrap edit-section" id="the-edit">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The UWA edit</p>
            <h2>
              A little inspiration.
              <br />A lot of possibility<span>.</span>
            </h2>
          </div>
          <p className="section-description">
            Different sides of your everyday.
            <br />
            One fresh point of view.
          </p>
        </div>
        <div className="editorial-grid">
          <Link
            href="/products?q=audio"
            className="editorial-card editorial-audio"
          >
            <div className="editorial-image">
              <Image
                src="/editorial/headphones.jpg"
                alt="Headphones as audio inspiration"
                fill
                sizes="(max-width: 700px) 90vw, 32vw"
              />
            </div>
            <span className="editorial-number">01 / TUNE IN</span>
            <div className="editorial-card-bottom">
              <h3>
                Find your
                <br />
                own rhythm.
              </h3>
              <span className="round-arrow">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
          <Link
            href="/products?q=technology"
            className="editorial-card editorial-tech"
          >
            <div className="editorial-image">
              <Image
                src="/editorial/laptop.jpg"
                alt="A laptop in a light-filled workspace"
                fill
                sizes="(max-width: 700px) 90vw, 32vw"
              />
            </div>
            <span className="editorial-number">02 / MAKE SPACE</span>
            <div className="editorial-card-bottom">
              <h3>
                Little tools.
                <br />
                Big possibilities.
              </h3>
              <span className="round-arrow">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
          <Link
            href="/products?q=care"
            className="editorial-card editorial-care"
          >
            <div className="editorial-image">
              <Image
                src="/editorial/care.jpg"
                alt="Everyday personal care inspiration"
                fill
                sizes="(max-width: 700px) 90vw, 32vw"
              />
            </div>
            <span className="editorial-number">03 / SLOW DOWN</span>
            <div className="editorial-card-bottom">
              <h3>
                A moment
                <br />
                just for you.
              </h3>
              <span className="round-arrow">
                <ArrowUpRight />
              </span>
            </div>
          </Link>
        </div>
        <p className="editorial-disclaimer">
          A visual moodboard for everyday living. Browse the collection for
          available products.
        </p>
      </section>
      <section className="brand-story">
        <div className="story-symbol" aria-hidden="true">
          <Asterisk strokeWidth={0.8} />
        </div>
        <div>
          <p className="eyebrow">Good things start with a point of view</p>
          <h2>
            Life isn’t one-size-fits-all.
            <br />
            Your everyday shouldn’t be either.
          </h2>
          <p>
            UWA is a space to discover the things that fit your life. A fresh
            perspective, a thoughtful find, a little more you.
          </p>
          <Link href="/about" className="text-link">
            A little about us <ArrowRight size={17} />
          </Link>
        </div>
        <MoveUpRight className="story-arrow" size={64} strokeWidth={1} />
      </section>
    </>
  );
}
