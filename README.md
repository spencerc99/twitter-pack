# Twitter Pack
This is the code for the [twitter pack for Coda](https://coda.io/packs/twitter-10029). See more info on [the explorer](https://coda.io/@spencer/twitter-pack-explorer)

# Contributing
Pull requests and issues are very welcome if you have any feature requests that you want to make! The current flow for development is making a pull request with the changes you forsee. Once that is done, I can add you as a tester to the Twitter Pack on the Coda side and help you push up a new version with the changes. Then we need to test the changes to make sure they are good before merging.

Note that we can only support endpoints on Twitter's v2 API because their v1 endpoints use a bespoke authentication that isn't supported with Coda. This unfortunately means there is a set of missing functionality that depends on Twitter upgrading their endpoints, but it's the right future-proof investment because they want to eventually deprecate v1 anyways. See the [full list of API]([url](https://developer.twitter.com/en/docs/twitter-api/data-dictionary/introduction)) for reference.
