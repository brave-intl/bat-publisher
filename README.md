# bat-publisher
Routines to identify publishers for the [BAT Ledger](https://github.com/brave-intl/bat-ledger):

* [Mapping a URL to a Publisher Identity](#publisher-identities)
* [Adding a Page Visit to a Browsing Synopsis](#page-visits)

## Publisher Identities
A _publisher identity_ is derived from a URL and is intended to correspond to the publisher associated with the URL.

    var getPublisher = require('bat-publisher').getPublisher

    var publisher = getPublisher('URL')

Note that because some domains host multiple publishers,
a publisher identity may contain both a _domain_ and a _path_ separated by a solidus(`/`).

Also note that certain URLs aren't really appropriate for a publisher mapping.
For example,
if a URL returns a 302,
don't bother mapping that URL.

### Terminology
Consider this URL:

    https://foo.bar.example.com/component1/...?query

The label `com` from the URL's domain is a [top-level domain](https://en.wikipedia.org/wiki/Top-level_domain) (TLD),
and the string `example.com` is a [second-level domain](https://en.wikipedia.org/wiki/Second-level_domain) (SLD).
By convention,
the _relative domain_ (RLD) is the string to the left of the SLD (e.g., `foo.bar`),
and the _qualifying label_ (QLD) is the right-most label of the RLD (e.g., `bar`).

There are two popular types of TLDs:
[infrastructure](https://en.wikipedia.org/wiki/Top-level_domain#Infrastructure_domain)
and [international country code](https://en.wikipedia.org/wiki/Internationalized_country_code_top-level_domain) (ccTLD).

Although an SLD is normally thought of being the next-to-last right-most label (e.g., `example`),
for domains with a ccTLD,
the convention differs.
Consider this URL:

    http://search.yahoo.co.jp/search?query

The string `co.jp` corresponds to the TLD, the string `yahoo.co.jp` corresponds to the SLD,
and the QLD and RLD are both the string `search`.

### Syntax
The ABNF syntax for a publisher identity is:

    publisher-identity = site-identity / provider-identity

        site-identity = domain [ "/" segment ]
                domain = [ RLD "." ] SLD
                   RLD = *[ label "." ] QLD
                   QLD = label
                   SLD = label "." TLD
                   TLD = infraTLD / ccTLD
                 ccTLD = label "." 2ALPHA                         ; a two-letter country code, cf. ISO 3166
              infraTLD = label                                    ; ".com", ".gov", etc.

                 label = alphanum *62(alphanum / "-")             ; any octet encoded according to RFC 2181
              alphanum = ALPHA / DIGIT
          path-abempty = *( "/" segment)                          ; as defined in Section 3.3 of RFC 3986

       provider-prefix = provider-scheme ":" provider-value

       provider-scheme = provider-prefix "#" provider-suffix
       provider-prefix = label
       provider-suffix = label

        provider-value = 1*(unreserved / pct-encoded)
           pct-encoded = "%" HEXDIG HEXDIG                        ; as defined in section 2.1 of RFC 3986
            unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"    ; as defined in section 2.3 of RFC 3986

Note that a `site-identity` must not include either a fragment (`#...`) or a query (`?...`).

    var isPublisher = require('bat-publisher').isPublisher

    if (isPublisher('...')) ...

### Mapping
The package uses a rule set expressed as a [JavaScript](https://en.wikipedia.org/wiki/JavaScript) array.

Each rule in the array consists of an object with one mandatory property,
`condition`,
a JavaScript boolean expression.
In addition,
there is usually either a `consequent` property
(a JavaScript expression returning either a string, `null`, or `undefined`),
or a `dom` property.

To detetermine the publisher identity associated with a URL:

1. If the TLD associated with the URL's domain does not correspond to an infrastructure or ccTLD,
then the publisher identity is `undefined`.

2. The URL is parsed into an object using the [URL module](https://nodejs.org/api/url.html).

3. The parsed object is extended with the `URL`, `TLD`, `SLD`, `RLD`, and `QLD` objects.
If there is no `RLD`, the empty string (`""`) is used for both the `RLD` and `QLD`.

4. If the `dom.publisher` property of the rule is present,
then the HTML associated with the URL must be present,
and one additional object is present during evaluation,
`node`, which is the result of `jsdom(markup).body.querySelector(dom.publisher.nodeSelector)`,
and the `dom.publisher.consequent` property is used instead of the `consequent` property for the rule in Step 5.2.

5. Each rule is examined, in order, starting from the first element:

    5.1. If the `condition` evaluates to `false`,
then execution continues with the next rule.

    5.2. Otherwise,
the `consequent` is evaluated.

    5.3. If the resulting value is the empty string (`""`),
then execution continues with the next rule.

    5.4. If the resulting value is `false`, `null` or `undefined`,
then the publisher identity is `undefined`.

    5.5. Otherwise,
the resulting value is used as the publisher identity.

6. If Step 5.5 is never executed,
then the publisher identity is `undefined`.

The initial rule set is built by a NPM script:

    npm run build-rules

An initial rule set is available as:

    require('bat-publisher').ruleset

### Your Help is Needed!
Please submit a [pull request](https://github.com/brave-intl/bat-publisher/pulls) with updates to the rule set.

If you are running the [Brave Browser](https://brave.com/downloads.html) on your desktop,
you can run

    % node dump.js

in order to examine all the URLs you have visited in your current session (from the file `session-store-1`)
and see the resulting publisher identities.

## Page Visits
A _page visit_ is just what you'd expect,
but it requires both a URL and the duration of the focus (in milliseconds).
A synopsis is a collection of page visits that have been reduced to a a publisher and a score.
The synopsis includes a rolling window so that older visits are removed.

    var synopsis = new (require('bat-publisher').Synopsis)()

    // each time a page is unloaded, record the focus duration
    // markup is an optional third-parameter, cf., getPublisher above
        synopsis.addVisit('URL', duration)

    // addVisit is a wrapper around addPublisher
        synopsis.addPublisher(publisher, props)

At present,
these properties are examined:

* `duration` - the number of milli-seconds (mandatory)

* `markup` - the HTML markup (optional)

In order to calculate the score,
options can be provided when creating the object.
The defaults are:

    { minPublisherDuration    : 8 * 1000
    , numFrames      : 30
    , frameSize      : 24 * 60 * 60 * 1000
    }

When `addVisit` is invoked,
the duration must be at least `minPublisherDuration` milliseconds in length.
If so,
then one or more "scorekeepers" are run to calculate the score for the visit,
using both the `options` and `props`.
At present,
there are two scorekeepers:

* `concave` - courtesy of [@dimitry-xyz](https://github.com/brave/ledger/issues/2#issuecomment-221752002)

* `visits` - the total number of visits

### The Concave Scorekeeper
The concave scorekeeper rewards the publisher of a page according to:

1. a fixed bonus for the page hit
2. how much time the user spends on the page

The reward increases as the user spends more time on the page, but the model uses a
concave quadratic (utility) function to provide diminishing returns as the time spent
on the page increases. If we set the `durationWeight` parameter to zero, the model 
only takes into account the page hit and ignores the time spent on the page when 
calculating the reward.

### Tuning
Scorekeepers may be "tuned" using options,
at present,
only the `concave` scorekeeper makes use of these.
The defaults are:

    { _d : 1 / (30 * 1000)              //    0.0000333...
    , _a : (1 / (_d * 2)) - minPublisherDuration // 5000
    , _b : minPublisherDuration - _a             // 5000
    }

The sliding window consist of `numFrames` frames,
each having a timeframe of `frameSize` milliseconds.
So, for the default values,
the sliding window will be `30` days long.

### Top Publishers
Once a synopsis is underway,
the "top N" publishers can be determined.
Each publisher will has an associated weighted score,
so that the sum of the scores "should approximate" `1.0`:

    // get the top "N" publishers

       console.log(JSON.stringify(synopsis.topN(20), null, 2))

    // e.g., [ { publisher: "example.com", weight 0.0123456789 } ... ]

The parameter to the `topN` method is optional.

Similarly,
to pseudo-randomly select a single publisher,
using the weighted score:

    // select a single publisher

       console.log(synopsis.winner())

    // e.g., "brave.com"

    // or multiple winners

       console.log(synopsis.winners(n))

## Acknowledgements
Many thanks to [Elijah Insua](https://github.com/tmpvar) for the excellent [jsdom](https://github.com/tmpvar/jsdom) package,
and to [Thomas Parisot](https://github.com/thom4parisot) for the excellent [tldjs](https://github.com/oncletom/tld.js) package.
