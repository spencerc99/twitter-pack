// This import statement gives you access to all parts of the Coda Packs SDK.
import * as coda from "@codahq/packs-sdk";

// This line creates your new Pack.
export const pack = coda.newPack();

const baseApiUrl = "api.twitter.com";
pack.addNetworkDomain(baseApiUrl);

// This is a simple wrapper that takes a relative Twitter url and turns into an absolute url.
// We recommend having helpers to generate API urls particularly when APIs use versioned
// urls, so that if you need to update to a new version of the API it is easy to do so
// in one place.
export function apiUrl(path: string, params?: Record<string, any>): string {
  const url = `https://${baseApiUrl}${path}`;
  return coda.withQueryParams(url, params || {});
}

// See if Twitter has given us the url of a next page of results.
function nextUrlFromResponse(
  path: string,
  params: Record<string, any>,
  response: coda.FetchResponse<any>
): string | undefined {
  const nextToken = response.body?.meta?.next_token;
  if (nextToken) {
    return apiUrl(path, { ...params, pagination_token: nextToken });
  }
}

pack.setSystemAuthentication({
  // Replace HeaderBearerToken with an authentication type
  // besides OAuth2, CodaApiHeaderBearerToken, None and Various.
  type: coda.AuthenticationType.HeaderBearerToken,
});

// pack.setUserAuthentication({
//   type: coda.AuthenticationType.OAuth2,
//   authorizationUrl: "https://twitter.com/i/oauth2/authorize",
//   tokenUrl: "https://api.twitter.com/oauth2/token",
//   additionalParams: {
//     redirect_uri: "https://coda.io/packsAuth/oauth2",
//     code_challenge: "challenge",
//     code_challenge_method: "plain",
//   },
//   scopes: ["tweet.write", "tweet.read", "users.read"],
// });

// This formula is used in the authentication definition in the manifest.
// It returns a simple label for the current user's account so the account
// can be identified in the UI.
// export const getConnectionName = coda.makeMetadataFormula(async context => {
//   const request: coda.FetchRequest = {
//     method: 'GET',
//     url: apiUrl('/user'),
//     headers: {
//       'Content-Type': 'application/json',
//     },
//   };
//   const response = await context.fetcher.fetch(request);
//   return (response.body as GitHubUser).login;
// });

// schemas + types
interface ReferencedTweet {
  type: any;
  id: string;
}

interface Attachment {
  media_keys: any[];
}

interface Coordinate {
  type: string;
  coordinates: number[];
  placeId: string;
}

interface TwitterGeo {
  coordinates: Coordinate;
}

interface PublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

interface TwitterTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  conversation_id: string;
  in_reply_to_user_id: string;
  referenced_tweets: ReferencedTweet[];
  attachments: Attachment;
  geo: TwitterGeo;
  public_metrics: PublicMetrics;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  location?: string;
  url?: string;
  verified?: boolean;
  profile_image_url?: string;
  public_metrics?: UserPublicMetrics;
}

interface TwitterMedia {
  media_key: string;
  url: string;
  // this should be an enum but whatever for now
  type: string;
}

const userSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  id: "id",
  primary: "username",
  identity: {
    name: "User",
  },
  properties: {
    id: { type: coda.ValueType.String },
    name: { type: coda.ValueType.String },
    username: { type: coda.ValueType.String },
    description: { type: coda.ValueType.String },
    location: { type: coda.ValueType.String },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    verified: { type: coda.ValueType.Boolean },
    profileImageUrl: {
      type: coda.ValueType.String,
      fromKey: "profile_image_url",
      codaType: coda.ValueHintType.ImageReference,
    },
    pinnedTweetId: { type: coda.ValueType.String, fromKey: "pinned_tweet_id" },
    followersCount: { type: coda.ValueType.Number, fromKey: "followers_count" },
    followingCount: { type: coda.ValueType.Number, fromKey: "following_count" },
    tweetCount: { type: coda.ValueType.Number, fromKey: "tweet_count" },
    listedCount: { type: coda.ValueType.Number, fromKey: "listed_count" },
  },
  featured: [
    "name",
    "username",
    "description",
    "location",
    "url",
    "profileImageUrl",
  ],
});

const mediaSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  id: "mediaKey",
  primary: "mediaKey",
  properties: {
    mediaKey: { type: coda.ValueType.String, fromKey: "media_key" },
    type: { type: coda.ValueType.String },
    imageUrl: {
      type: coda.ValueType.String,
      fromKey: "url",
      codaType: coda.ValueHintType.ImageAttachment,
    },
  },
  featured: ["mediaKey", "type", "imageUrl"],
});

const tweetSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  // The property name from the properties object below that represents the unique
  // identifier of this item. A sync table MUST have a stable unique identifier. Without
  // one, each subsequent sync will wipe away all rows and recreate them from scratch.
  id: "id",
  // The property name from the properties object below that should label this item
  // in the UI. All properties can be seen when hovering over a synced item in the UI,
  // but the primary property value is shown on the chip representing the full object.
  primary: "id",
  // The actual schema properties.
  properties: {
    id: { type: coda.ValueType.String },
    text: { type: coda.ValueType.String, codaType: coda.ValueHintType.Html },
    createdAt: {
      type: coda.ValueType.String,
      fromKey: "created_at",
      codaType: coda.ValueHintType.DateTime,
    },
    author: { ...userSchema },
    conversationId: { type: coda.ValueType.String, fromKey: "conversation_id" },
    inReplyToUserId: {
      type: coda.ValueType.String,
      fromKey: "in_reply_to_user_id",
    },
    likeCount: { type: coda.ValueType.Number, fromKey: "like_count" },
    retweetCount: { type: coda.ValueType.Number, fromKey: "retweet_count" },
    replyCount: { type: coda.ValueType.Number, fromKey: "reply_count" },
    quoteCount: { type: coda.ValueType.Number, fromKey: "quote_count" },
    media: { type: coda.ValueType.Array, items: mediaSchema },
    url: { type: coda.ValueType.String, codaType: coda.ValueHintType.Url },
    // referencedTweets: {type: coda.ValueType.Array, items: referencedTweetSchema, fromKey: 'referenced_tweets'},
  },
  featured: ["text", "createdAt", "author"],
});

interface TweetAnnotationInfo {
  users?: TwitterUser[];
  media?: TwitterMedia[];
}

interface UserPublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
}

interface UserAnnotationInfo {
  pinnedTweetId?: string;
}

function parseTweet(
  { public_metrics, attachments, ...tweetInfo }: TwitterTweet,
  annotationInfo: TweetAnnotationInfo
) {
  const { users, media } = annotationInfo;
  const mediaKeys = attachments?.media_keys;
  const author = users?.find((u) => u.id === tweetInfo.author_id);
  const mediaForTweet = media?.filter((m) => mediaKeys?.includes(m.media_key));
  const url = author.username
    ? "twitter.com/" + author.username + "/status/" + tweetInfo.id
    : undefined;
  return { ...tweetInfo, ...public_metrics, author, media: mediaForTweet, url };
}

// in the form of https://pbs.twimg.com/profile_images/1356386881030680580/7WZgSya4_normal.jpg
// so this strips out the _normal which gives a bigger one
function transformProfileImage(profileImageUrl: string) {
  return profileImageUrl.replace("_normal", "");
}

function parseUser(
  { profile_image_url, public_metrics, ...userInfo }: TwitterUser,
  { pinnedTweetId }: UserAnnotationInfo = {}
) {
  return {
    profile_image_url: transformProfileImage(profile_image_url),
    ...userInfo,
    pinnedTweetId,
    ...public_metrics,
  };
}

const UserLookupFields =
  "description,location,profile_image_url,url,verified,username,public_metrics";

async function getUser([inputHandle]: any[], context: coda.ExecutionContext) {
  const params = {
    "user.fields": UserLookupFields,
    expansions: "pinned_tweet_id",
  };

  const handle = inputHandle.replace(/@/g, "").trim();
  const basePath = `/2/users/by/username/${handle}`;
  let url = apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data } = response.body;
  return parseUser(data);
}

const CommonTweetFields = "created_at,conversation_id,geo,public_metrics";

async function getProfileTweets(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  // found using https://codeofaninja.com/tools/find-twitter-id/
  // TODO: can this be automated if you're using user auth?
  const params = {
    expansions: "author_id,attachments.media_keys",
    "tweet.fields": CommonTweetFields,
    "user.fields": "profile_image_url",
    // for some reason preview_image_url not working?
    "media.fields": "url,media_key,type",
    max_results: 100,
  };
  const basePath = `/2/users/${id}/tweets`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);
  // context.logger.info('continuation: ' + continuation);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawTweet) => parseTweet(rawTweet, annotationInfo));
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  if (!results) {
    console.log("No data found: " + JSON.stringify(response, null, 2));
  } else {
    console.log(
      `Found ${results.length} profile Tweets: ` +
        JSON.stringify(response, null, 2)
    );
  }
  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

async function getLikedTweets(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  // found using https://codeofaninja.com/tools/find-twitter-id/
  // TODO: can this be automated if you're using user auth?
  const params = {
    expansions: "author_id,attachments.media_keys",
    "tweet.fields": CommonTweetFields,
    "user.fields": "profile_image_url",
    "media.fields": "url,media_key,type",
    max_results: 100,
  };
  const basePath = `/2/users/${id}/liked_tweets`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);
  // context.logger.info('continuation: ' + continuation);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawTweet) => parseTweet(rawTweet, annotationInfo));
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

async function getSearchTweets(
  [query, mode]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: "author_id,attachments.media_keys",
    "tweet.fields": CommonTweetFields,
    "user.fields": "profile_image_url",
    "media.fields": "url,media_key,type",
    query,
    max_results: 100,
  };
  const basePath = `/2/tweets/search/recent`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawTweet) => parseTweet(rawTweet, annotationInfo));
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

const userIdParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "userId",
  description:
    "The id for a Twitter user. Find by handle using https://codeofaninja.com/tools/find-twitter-id/",
});

const queryParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "query",
  description:
    "The query for a Twitter search. See https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query for more info on how to build a query",
});

pack.addSyncTable({
  // The display name for the table, shown in the UI.
  name: "LikedTweets",
  // The unique identifier for the table.
  identityName: "LikedTweets",
  schema: tweetSchema,
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "LikedTweets",
    description: "Fetches the tweets that a given user has liked.",

    parameters: [userIdParameter],

    // This indicates whether or not your sync table requires an account connection.
    connectionRequirement: coda.ConnectionRequirement.None,

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getLikedTweets(params, context, context.sync.continuation),
  },
});

pack.addSyncTable({
  // The display name for the table, shown in the UI.
  name: "ProfileTweets",
  // The unique identifier for the table.
  identityName: "ProfileTweets",
  schema: tweetSchema,
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "ProfileTweets",
    description: "Fetches the tweets that for a given user.",

    parameters: [userIdParameter],

    // This indicates whether or not your sync table requires an account connection.
    connectionRequirement: coda.ConnectionRequirement.None,

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getProfileTweets(params, context, context.sync.continuation),
  },
});

pack.addSyncTable({
  name: "SearchTweets",
  identityName: "SearchTweets",
  schema: tweetSchema,
  formula: {
    name: "SearchTweets",
    description: "Fetches tweets for a given search query.",

    parameters: [queryParameter],

    connectionRequirement: coda.ConnectionRequirement.None,

    execute: (params, context) =>
      getSearchTweets(params, context, context.sync.continuation),
  },
});

// Here, we add a new formula to this Pack.
pack.addFormula({
  // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
  name: "GetUser",
  description: "Gets information about a twitter user by handle.",
  // If your formula requires one or more inputs, you’ll define them here.
  // Here, we're creating a string input called “name”.
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "handle",
      description: "The Twitter handle you're interested in (omit the @)",
    }),
  ],

  execute: getUser,
  resultType: coda.ValueType.Object,
  schema: userSchema,
});

async function getUserFollowers(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: "pinned_tweet_id",
    "tweet.fields": CommonTweetFields,
    "user.fields": UserLookupFields,
    max_results: 1000,
  };
  const basePath = `/2/users/${id}/followers`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);
  // context.logger.info('continuation: ' + continuation);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawFollower) =>
    parseUser(rawFollower, annotationInfo)
  );
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  if (!results) {
    console.log("No data found: " + JSON.stringify(response, null, 2));
  } else {
    console.log(
      `Found ${results.length} user followers: ` +
        JSON.stringify(response, null, 2)
    );
  }
  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

async function getUserFollowing(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: "pinned_tweet_id",
    "tweet.fields": CommonTweetFields,
    "user.fields": UserLookupFields,
    max_results: 1000,
  };
  const basePath = `/2/users/${id}/following`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawFollower) =>
    parseUser(rawFollower, annotationInfo)
  );
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  if (!results) {
    console.log("No data found: " + JSON.stringify(response, null, 2));
  } else {
    console.log(
      `Found ${results.length} user following: ` +
        JSON.stringify(response, null, 2)
    );
  }
  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

async function postTweet(
  [tweet]: any[],
  context: coda.ExecutionContext
): Promise<string> {
  const response = await context.fetcher.fetch({
    method: "POST",
    url: apiUrl("/2/tweets"),
    body: JSON.stringify({
      text: tweet,
    }),
  });
  console.log(JSON.stringify(response.body, null, 2));
  return "OK";
}

pack.addSyncTable({
  name: "UserFollowers",
  identityName: "UserFollowers",
  schema: userSchema,
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "UserFollowers",
    description: "Fetches the followers of a given user.",

    parameters: [userIdParameter],

    // This indicates whether or not your sync table requires an account connection.
    connectionRequirement: coda.ConnectionRequirement.None,

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getUserFollowers(params, context, context.sync.continuation),
  },
});

pack.addSyncTable({
  name: "UserFollowing",
  identityName: "UserFollowing",
  schema: userSchema,
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "UserFollowing",
    description: "Fetches the people following a given user.",

    parameters: [userIdParameter],

    // This indicates whether or not your sync table requires an account connection.
    connectionRequirement: coda.ConnectionRequirement.None,

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getUserFollowing(params, context, context.sync.continuation),
  },
});

pack.addColumnFormat({
  name: "User",
  formulaNamespace: "TwitterPack", // Will be removed shortly
  formulaName: "GetUser",
  instructions: "Gets the user for a specific twitter handle",
});

// pack.addFormula({
//   resultType: coda.ValueType.String,
//   name: "PostTweet",
//   description: "Post a tweet",
//   parameters: [
//     coda.makeParameter({
//       type: coda.ParameterType.String,
//       name: "tweet",
//       description: "The tweet to post",
//     }),
//   ],
//   execute: postTweet,
//   connectionRequirement: coda.ConnectionRequirement.Required,
// });
