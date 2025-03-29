import type Site from "lume/core/site.ts";
import { log } from "lume/core/utils/log.ts";
import { merge } from "lume/core/utils/object.ts";


/* TODO List
 - Pass element that wraps measurable content in config or frontmatter.
   We currently fall back nicely to just whatever is in the <body>, but 
   many authors wrap their {{ content }} in a div with a class, which 
   would be appropriate here.

 - Create a plugin to present the _seo_report.json file meaningfully? 
   Use a more consistent log format?
 */

// For internationalization support
export type LengthUnit = "character" | "grapheme" | "word" | "sentence";

interface Options {
  /* Titles should ideally be under 80 characters */
  warnTitleLength?: boolean;
  /* long URLs can be problematic */
  warnUrlLength?: boolean;
  /* Warn if content is too short / long */
  warnContentLength?: boolean;
  /* If metas is installed, warn on description length? */
  warnMetasDescriptionLength?: boolean;
  /* If metas is installed, warn on description common words? */
  warnMetasDescriptionCommonWords?: boolean;
  /* There should only be one <h1> tag per node */
  warnDuplicateHeadings?: boolean;
  /* Warn if heading elements are used out of order? */
  warnHeadingOrder?: boolean;
  /* Try to use non-common words in precious URL space! */
  warnUrlCommonWords?: boolean;
  /* Try to use non-common words in precious title space! */
  warnTitleCommonWords?: boolean;
  /* Meta descriptions can be longer than titles */
  thresholdMetaDescriptionLength?: number;
  /* Minimum content length */
  thresholdContentMinimum?: number;
  /* Maximum content length */
  thresholdContentMaximum?: number;
  /* How long is too long for titles */
  thresholdLength?: number;
  /* What % of thresholdLength should be applied to URLs? */
  thresholdLengthPercentage?: number;
  /* What % of common words is okay in precious space? */
  thresholdCommonWordsPercent?: number;
  /* Min length for common word percentage checks */
  thresholdLengthForCWCheck?: number;
  /* Inject your own set of common words */
  userCommonWordSet?: Set<string>;
  /* This is also basic accessibility: images need alt="" attribute */
  warnImageAltAttribute?: boolean;
  /* Not using titles is a waste of indexable space. */
  warnImageTitleAttribute?: boolean;
  /* What source extensions to check? .md(x) by default. */
  extensions?: string[];
  /* URL (page.data.url) list to skip processing */
  ignore?: string[];
  /* Console, file or function */
  output?: string | ((seoWarnings: Map<string, Set<string>>) => void) | null;
  /* Remove output file if run finishes with no warnings? */
  removeReportFile?: boolean;
  /* Unit for length checks. See LengthUnit type above */
  lengthUnit?: LengthUnit;
  /* Default Locale If It Can't Be Determined By The page */
  lengthLocale?: string;
  /* Callback function for common word percentage */
  commonWordPercentageCallback?: ((title: string) => number) | null;
}

export const defaults: Options = {
  extensions: [".html"],
  ignore: ["/404.html"],
  warnTitleLength: true,
  warnUrlLength: true,
  warnContentLength: true,
  warnMetasDescriptionLength: true,
  warnMetasDescriptionCommonWords: true,
  warnDuplicateHeadings: true,
  warnHeadingOrder: true,
  warnTitleCommonWords: true,
  warnUrlCommonWords: true,
  warnImageAltAttribute: true,
  warnImageTitleAttribute: true,
  thresholdMetaDescriptionLength: 150,
  thresholdContentMinimum: 4000,
  thresholdContentMaximum: 20000,
  thresholdLength: 80,
  thresholdLengthPercentage: 0.7,
  thresholdLengthForCWCheck: 35,
  thresholdCommonWordsPercent: 45,
  removeReportFile: true,
  output: null,
  lengthUnit: "character",
  lengthLocale: "en",
  commonWordPercentageCallback: null,
};

export default function seo(userOptions?: Options) {
  const options = merge(defaults, userOptions);
  const lengthUnit = options.lengthUnit;

  function getLength(
    text: string,
    unit: LengthUnit,
    locale: string,
  ): number {
    if (!text) return 0;
    if (unit === "character") {
      return text.length;
    }

    const segmenter = new Intl.Segmenter(locale, { granularity: unit });
    const segments = segmenter.segment(text);
    let count = 0;
    for (const _ of segments) {
      count++;
    }
    return count;
  }

  /* You can pass a custom dictionary object, if the word segmentation
   * logic otherwise works for you. If you need different segmentation 
   * to examine "words", you can instead pass your own callback. This 
   * was the best way I could think to be as multi-language-friendly
   * as possible.
   */
  function calculateCommonWordPercentage(title: string): number {
    if (!title) return 0;
    title = title.trim();
    if (options.commonWordPercentageCallback) {
      return options.commonWordPercentageCallback(title);
    }
    const processedTitle = title.toLowerCase().replace(/[^\w\s]/g, "");
    const words = processedTitle.split(/\s+/);
    // dprint-ignore // deno-fmt-ignore
    const commonWords = options.userCommonWordSet
      ? options.userCommonWordSet
      : new Set([
        // Not exhaustive! Compiled from dozens of sources,
        // but not exhaustive. These seem to be the most 
        // common among all the lists of lists of lists of 
        // words like this. Also the most common on academic
        // slides explaining English. Yay, another list!
        "the", "a", "an", "and", "but",
        "or", "nor", "for", "so", "yet",
        "to", "in", "at", "on", "by",
        "with", "of", "from", "as", "is",
        "are", "was", "were", "be", "been",
        "have", "has", "had", "do", "does",
        "did", "will", "would", "can", "could",
        "should", "may", "might", "must", "i",
        "you", "he", "she", "it", "we",
        "they", "me", "him", "her", "us",
        "them", "my", "your", "his", "hers",
        "its", "our", "their", "this", "that",
        "these", "those", "one", "two", "three",
        "four", "five", "first", "last", "new",
        "good", "bad", "man", "woman", "child",
        "time", "year", "day", "night", "now",
        "then", "very", "much", "many", "some",
        "all", "any", "most", "other", "more",
        "out", "up", "down", "over", "under",
        "again", "also", "however", "therefore", "because",
        "since", "while", "before", "after", "if",
        "unless", "though", "although", "even", "still",
        "yet", "now", "just", "only", "well",
        "too", "very", "quite", "rather", "really",
        "almost", "enough", "about", "above", "across",
        "after", "against", "along", "among", "around",
        "at", "before", "behind", "below", "beneath",
        "beside", "besides", "between", "beyond", "but",
        "by", "down", "during", "except", "for",
        "from", "in", "inside", "into", "like",
        "near", "next", "of", "off", "on",
        "onto", "out", "outside", "over", "past",
        "round", "since", "through", "throughout", "to",
        "toward", "towards", "under", "underneath", "until",
        "up", "upon", "up to", "with", "within",
        "without",
      ]);

    let commonWordCount = 0;
    for (const word of words) {
      if (commonWords.has(word)) {
        commonWordCount++;
      }
    }

    const percentage = words.length === 0
      ? 0
      : (commonWordCount / words.length) * 100;

    return percentage;
  }

  const cachedWarnings = new Map<string, Set<string>>();

  return (site: Site) => {
    // very similar to how Check Urls plugin does this
    function JSONIfyCachedWarnings(): string {
      const content = JSON.stringify(
        Object.fromEntries(
          Array.from(cachedWarnings.entries())
            .map(([url, refs]) => [url, Array.from(refs)]),
        ),
        null,
        2,
      );
      return content;
    }

    function writeWarningsToFile(): void {
      log.warn(
        `SEO: Warnings were issued during this run. Report saved to ${options.output}`,
      );
      const content = JSONIfyCachedWarnings();
      // we only get here if options.output is a string
      Deno.writeTextFileSync(<string> options.output, content);
      return;
    }

    function writeWarningsToConsole(): void {
      log.warn("SEO: Warnings were issued during this run. Report as follows:");
      const content = JSONIfyCachedWarnings();
      console.dir(content);
      return;
    }

    function deleteReportFile(): void {
      if (
        typeof (options.output) === "string" && options.removeReportFile
      ) {
        try {
          Deno.removeSync(options.output);
        } catch (_error) {
          // do nothing
        }
      }
    }
    let warningCount = 0;
    cachedWarnings.clear();
    site.process(options.extensions, (pages) => {
      log.info("SEO: Running SEO checks ...");
      for (const page of pages) {
        const frontMatter = page.data.seo || null;
        if (page.data.url && options.ignore.includes(page.data.url)) {
          log.info(`SEO: Skipping ${page.data.url} per options.`);
          continue;
        }

        if (frontMatter && frontMatter.ignore === true) {
          log.info(`SEO: Skipping ${page.data.url} per frontmatter setting.`);
          continue;
        }

        const warnings = [];

        log.info(`SEO: Processing ${page.data.url} ...`);

        // This can't be blank, so set a default if we can't find a language.
        const locale = page.data.lang || options.lengthLocale;

        if (options.warnTitleLength && page.data.title) {
          const titleLength = getLength(
            page.document.title,
            lengthUnit,
            locale,
          );
          if (titleLength >= options.thresholdLength) {
            warnings[warningCount] =
              `Title is over ${options.thresholdLength} ${lengthUnit}${
                options.thresholdLength === 1 ? "" : "s"
              }; less is more.`;
          }
        }

        if (options.warnUrlLength) {
          const urlLength = getLength(
            page.data.url,
            lengthUnit,
            locale,
          );
          const maxLength = options.thresholdLength *
            options.thresholdLengthPercentage;
          if (urlLength >= maxLength) {
            warnings[warningCount++] =
              `URL meets or exceeds ${maxLength} ${lengthUnit}${
                maxLength === 1 ? "" : "s"
              }, which is ${options.thresholdLengthPercentage} of the title limit; consider shortening.`;
          }
        }

        if (options.warnContentLength) {
          if (frontMatter && frontMatter.skip_content === true) {
            log.info(
              `SEO: Skipping content length check on ${page.data.url} per frontmatter.`,
            );
          } else {
            if (page.document.body) {
              const contentLength = getLength(
                page.document.body.textContent as string,
                lengthUnit,
                locale,
              );
              if (contentLength < options.thresholdContentMinimum) {
                warnings[warningCount++] =
                  `Content length (${contentLength}) is less than ${options.thresholdContentMinimum} ${lengthUnit}${
                    options.thresholdContentMinimum === 1 ? "" : "s"
                  }, anything to add?`;
              } else if (
                contentLength >= options.thresholdContentMaximum
              ) {
                warnings[warningCount++] =
                  `Content length meets or exceeds ${options.thresholdContentMaximum} ${lengthUnit}${
                    options.thresholdContentMaximum === 1 ? "" : "s"
                  }, can this be split up?`;
              }
            }
          }
        }

        if (options.warnDuplicateHeadings) {
          const headingOneCount = page.document.querySelectorAll("h1").length;
          if (headingOneCount && headingOneCount > 1) {
            warnings[warningCount++] =
              "More than one <h1> element. This is almost never what you want.";
          }
        }

        if (options.warnHeadingOrder) {
          const headings = page.document.querySelectorAll(
            "h1, h2, h3, h4, h5, h6",
          );
          let previousLevel = 0;
          for (const heading of headings) {
            // h1 becomes 1, h2 becomes 2, etc.
            const currentLevel = parseInt(heading.tagName.slice(1));
            if (currentLevel > previousLevel + 1) {
              warnings[warningCount++] =
                `Heading elements out of order: ${heading.tagName} - Headings should be in semantic order.`;
            }
            previousLevel = currentLevel;
          }
        }

        if (
          (options.warnImageAltAttribute || options.warnImageTitleAttribute)
        ) {
          for (const img of page.document.querySelectorAll("img")) {
            if (
              img && options.warnImageAltAttribute && !img.hasAttribute("alt")
            ) {
              warnings[warningCount++] =
                "Image is missing alt attribute. This also breaks accessibility!";
            }
            if (
              img && options.warnImageTitleAttribute &&
              !img.hasAttribute("title")
            ) {
              warnings[warningCount++] =
                "Suggest using image title attributes strategically.";
            }
          }
        }

        if (
          options.warnTitleCommonWords && page.data.title &&
          page.document.title.length >= options.thresholdLengthForCWCheck
        ) {
          const titleCommonWords = calculateCommonWordPercentage(
            page.document.title,
          );
          if (titleCommonWords >= options.thresholdCommonWordsPercent) {
            warnings[warningCount++] =
              `SEO: Title has a large percentage (${titleCommonWords}) of common words; consider revising.`;
          }
        }

        if (
          options.warnUrlCommonWords && page.data.url &&
          page.data.url.length >= options.thresholdLengthForCWCheck
        ) {
          const urlCommonWords = calculateCommonWordPercentage(page.data.url);
          if (urlCommonWords >= options.thresholdCommonWordsPercent) {
            warnings[warningCount++] =
              `SEO: URL has a large percentage (${urlCommonWords}) of common words; consider revising.`;
          }
        }

        if (options.warnMetasDescriptionLength && page.data.metas) {
          if (frontMatter && frontMatter.skip_metas === true) {
            log.info(
              `SEO: Skipping meta description length check on ${page.data.url} per frontmatter.`,
            );
          } else {
            const metaDescriptionElement = page.document.querySelector('meta[name="description"]');
            const metaDescription = metaDescriptionElement?.getAttribute("content") || null;
            if (metaDescription) {
              const metaDescriptionLength = getLength(
                page.data.metas.description,
                lengthUnit,
                locale,
              );
              if (
                metaDescriptionLength >=
                options.thresholdMetaDescriptionLength
              ) {
                warnings[warningCount++] =
                  `SEO: Meta Description Length For ${page.data.url} meets or exceeds ${options.thresholdMetaDescriptionLength} ${lengthUnit}${
                    options.thresholdMetaDescriptionLength === 1 ? "" : "s"
                  }`;
              }
            }
          }
        }

        if (options.warnMetasDescriptionCommonWords && page.data.metas) {
          if (frontMatter && frontMatter.skip_metas === true) {
            log.info(
              `SEO: Skipping meta description common word count on ${page.data.url} per frontmatter.`,
            );
          } else {
            const metaDescriptionElement = page.document.querySelector('meta[name="description"]');
            const metaDescription = metaDescriptionElement?.getAttribute("content") || null;
            if (
              metaDescription &&
              calculateCommonWordPercentage(metaDescription) >=
                options.thresholdCommonWordsPercent
            ) {
              warnings[warningCount++] =
                `SEO: Meta Description Common Word Percent For ${page.data.url} meets or exceeds ${options.thresholdCommonWordsPercent}`;
            }
          }
        }

        if (warningCount) {
          cachedWarnings.set(page.data.url, new Set(warnings));
          warningCount = 0;
        }
      }

      // Do we have anything to report?
      if (cachedWarnings.size) {
        if (typeof options.output === "function") {
          options.output(cachedWarnings);
        } else if (typeof options.output === "string") {
          writeWarningsToFile();
        } else {
          writeWarningsToConsole();
        }
      } else {
        deleteReportFile();
        cachedWarnings.clear();
        log.info("SEO: No warnings to report! Good job! 🎉");
      }
    });
  };
}
