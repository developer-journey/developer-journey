Many of the elements in this directory will eventually be broken
out into their own Polymer element project; for now, to simplify
code sharing and development, they are all being hosted within
the main DJ project.


Element             | Usage
--------------------|------------------------------------------
clone-line          | git/https clone line; used by journey-info
journey-banner      | Element in the top banner
journey-editor      | Editor components -> Pipes edits to app.journey-content
journey-create      | Create page for DJ
journey-frontmatter | Parses the journey yaml front-matter
journey-image       | Image element supporting styles defined by DJ.
journey-info        | Not used in most recent versions.
journey-list        | 
journey-picker      | Grid view showing a set of journey-thumbs 
journey-step        | Used in rendered DJ markdown
journey-markdown    | Render markdown-it in a Polymer element. type=[blog|tutorial|status-report|plain]
