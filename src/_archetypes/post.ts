export default function (title: string) {
  const slug = title.replace(/\s+/g, "-").toLowerCase();
  const pageContent = `

Opening teaser here

<img src="/uploads/${slug}.jpg" alt="" title="" />

<!--more-->
  
More Text here
  
## Heading 

More text comes next ...

`;
  return {
    path: `/blog/${slug}.mdx`,
    content: {
      title: title,
      date: new Date().toISOString().slice(0, 10),
      author: "Mike Wazowski",
      draft: true,
      tags: ["tag-1", "tag-2"],
      metas: {
        lang: "en",
        description: "Short meta description (up to 170 chars)",
        tags: ["meta tag one", "meta tag two"],
        image: "/uploads/" + slug + ".jpg",
        robots: false,
        generator: true,
      },
      content: pageContent,
    },
  };
}
