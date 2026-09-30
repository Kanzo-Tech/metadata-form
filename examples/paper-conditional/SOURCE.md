# The paper's running example

`shapes.ttl` is **Listing 1** of the paper (`tex/listings/example.ttl` in the
paper repository): a `@prefix` block, then the listing's triples verbatim. A test
(`test/paper-listing.test.ts`) keeps the body byte-identical to the listing when
the paper repository is at hand (`PAPER_LISTINGS`, the directory holding
`example.ttl`).

`sample.ttl` is a `dcat:Dataset` with an English title and
`healthdcatap:hasStructuredData false`. Set it to true and the variables field
appears, required.
