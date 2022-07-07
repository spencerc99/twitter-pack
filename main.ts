import * as coda from "@codahq/packs-sdk";

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

// This formula is used in the authentication definition in the manifest.
// It returns a simple label for the current user's account so the account
// can be identified in the UI.
const getConnectionName = coda.makeMetadataFormula(async (context) => {
  const request: coda.FetchRequest = {
    method: "GET",
    url: apiUrl("/2/users/me"),
  };
  const response = await context.fetcher.fetch(request);
  return response.body?.data?.username;
});

pack.setSystemAuthentication({
  type: coda.AuthenticationType.HeaderBearerToken,
});

const OAuthScopesRead = [
  "offline.access",
  "tweet.read",
  "users.read",
  "bookmark.read",
];
const OAuthScopesReadWrite = [
  ...OAuthScopesRead,
  "tweet.write",
  "bookmark.write",
  "like.write",
];

pack.setUserAuthentication({
  type: coda.AuthenticationType.OAuth2,
  authorizationUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  scopes: OAuthScopesRead,
  useProofKeyForCodeExchange: true,
  getConnectionName,
});

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
  created_at: string;
}

interface TwitterMediaVariant {
  bit_rate?: number;
  content_type: "video/mp4" | string;
  url: string;
}

interface TwitterMedia {
  media_key: string;
  // this should be an enum but whatever for now
  type: string;
  url?: string;
  preview_image_url?: string;
  variants?: TwitterMediaVariant[];
}

const CommonTweetFields = "created_at,conversation_id,geo,public_metrics";
const CommonTweetExpansions = "author_id,attachments.media_keys";
const CommonTweetMediaFields = "url,media_key,type,preview_image_url,variants";
const CommonTweetUserFields =
  "description,location,profile_image_url,url,verified,username,public_metrics,created_at,protected";
const UserLookupFields = CommonTweetUserFields;

const CommonUserExpansions = "pinned_tweet_id";

const userSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  idProperty: "id",
  displayProperty: "username",
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
    createdAt: {
      type: coda.ValueType.String,
      fromKey: "created_at",
      codaType: coda.ValueHintType.DateTime,
    },
    pinnedTweetId: { type: coda.ValueType.String, fromKey: "pinned_tweet_id" },
    followersCount: { type: coda.ValueType.Number, fromKey: "followers_count" },
    followingCount: { type: coda.ValueType.Number, fromKey: "following_count" },
    tweetCount: { type: coda.ValueType.Number, fromKey: "tweet_count" },
    listedCount: { type: coda.ValueType.Number, fromKey: "listed_count" },
    protected: { type: coda.ValueType.Boolean },
  },
  featuredProperties: [
    "name",
    "username",
    "description",
    "location",
    "url",
    "profileImageUrl",
  ],
});

const followerSchema = coda.makeObjectSchema({
  ...userSchema,
  identity: {
    name: "FollowerUser",
  },
});
const followingSchema = coda.makeObjectSchema({
  ...userSchema,
  identity: { name: "FollowingUser" },
});

const mediaSchema = coda.makeObjectSchema({
  type: coda.ValueType.Object,
  idProperty: "mediaKey",
  displayProperty: "imageUrl",
  properties: {
    mediaKey: {
      type: coda.ValueType.String,
      fromKey: "media_key",
      required: true,
    },
    type: { type: coda.ValueType.String },
    imageUrl: {
      type: coda.ValueType.String,
      fromKey: "url",
      codaType: coda.ValueHintType.ImageReference,
      required: true,
    },
    videoUrl: {
      type: coda.ValueType.String,
      codaType: coda.ValueHintType.Url,
    },
    video: {
      type: coda.ValueType.String,
      fromKey: "videoUrl",
      codaType: coda.ValueHintType.Embed,
    },
  },
  featuredProperties: ["mediaKey", "type", "imageUrl"],
});

const commonTweetSchema: any = {
  type: coda.ValueType.Object,
  idProperty: "id",
  displayProperty: "text",
  identity: {
    name: "Tweet",
  },
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
  featuredProperties: ["text", "createdAt", "author", "media"],
};

const tweetSchema = coda.makeObjectSchema(commonTweetSchema);

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

function parseTweetText(text: string): string {
  return text
    .replace(/\n/g, "<br/>")
    .replace(/&amp;/g, "&")
    .replace(/(https:\/\/t\.co.+)/g, "<a href='$1'>$1</a>");
}

function parseMedia({
  url,
  preview_image_url,
  variants,
  ...rest
}: TwitterMedia) {
  return {
    ...rest,
    url: url ?? preview_image_url,
    videoUrl: variants?.[0].url,
  };
}

function parseTweet(
  { public_metrics, attachments, text, ...tweetInfo }: TwitterTweet,
  annotationInfo: TweetAnnotationInfo
) {
  const { users, media } = annotationInfo;
  const mediaKeys = attachments?.media_keys;
  const author = users?.find((u) => u.id === tweetInfo.author_id);
  const mediaForTweet = media?.filter((m) => mediaKeys?.includes(m.media_key));
  const url = author.username
    ? "https://twitter.com/" + author.username + "/status/" + tweetInfo.id
    : undefined;
  const transformedText = parseTweetText(text);
  return {
    ...tweetInfo,
    text: transformedText,
    ...public_metrics,
    author: parseUser(author),
    media: mediaForTweet?.map(parseMedia),
    url,
  };
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

// https://twitter.com/spencerc99
const TweetUserUrlRegex = /^.*twitter\.com\/@?(\w+)\??[^\/]*\/?$/;
// https://twitter.com/spencerc99/status/1541857534234984450
const TweetUrlRegex = /^.*twitter\.com\/@?\w+\/status\/(\d+)\??[^\/]*\/?$/;
const TwitterHandleRegex = /^\w+$/;

async function getTweet(
  [tweetIdOrUrl]: string[],
  context: coda.ExecutionContext
) {
  const maybeTweetIdMatch = tweetIdOrUrl.match(TweetUrlRegex)?.[1];
  const tweetId = (maybeTweetIdMatch ?? tweetIdOrUrl).trim();

  if (Number.isNaN(Number(tweetId))) {
    throw new coda.UserVisibleError("Invalid tweet id");
  }

  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    "media.fields": CommonTweetMediaFields,
  };
  const url = apiUrl(`/2/tweets/${tweetId}`, params);
  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  return parseTweet(data, annotationInfo);
}

async function getUser([inputHandle]: any[], context: coda.ExecutionContext) {
  const params = {
    "user.fields": UserLookupFields,
    expansions: CommonUserExpansions,
  };

  const maybeHandleMatch = inputHandle.match(TweetUserUrlRegex)?.[1];
  const handle = (maybeHandleMatch ?? inputHandle).replace(/@/g, "").trim();
  if (!TwitterHandleRegex.test(handle)) {
    throw new coda.UserVisibleError("Invalid handle");
  }

  const basePath = `/2/users/by/username/${handle}`;
  let url = apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data } = response.body;
  return parseUser(data);
}

function parseDateParameter(date?: Date): [string, string] {
  let startTime;
  let endTime;
  if (date) {
    const startDate = new Date(date as Date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date as Date);
    endDate.setUTCHours(23, 59, 59, 0);
    startTime = startDate.toISOString();
    endTime = endDate.toISOString();
  }
  return [startTime, endTime];
}

async function getProfileTweets(
  [userId, lastTweetId, date]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const [startTime, endTime] = parseDateParameter(date);

  // found using https://codeofaninja.com/tools/find-twitter-id/
  // TODO: can this be automated if you're using user auth?
  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    // for some reason preview_image_url not working?
    "media.fields": CommonTweetMediaFields,
    max_results: 25,
    ...(lastTweetId ? { since_id: lastTweetId } : {}),
    ...(startTime ? { end_time: endTime, start_time: startTime } : {}),
  };
  const basePath = `/2/users/${userId}/tweets`;
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
  [userId, lastTweetId]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  // Not currently accepted either.
  // const [startTime, endTime] = parseDateParameter(date);
  // found using https://codeofaninja.com/tools/find-twitter-id/
  // TODO: can this be automated if you're using user auth?
  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    "media.fields": CommonTweetMediaFields,
    max_results: 25,
    // Apparently this is not accepted as a parameter lol
    // ...(lastTweetId ? { since_id: lastTweetId } : {}),
    // ...(startTime ? { end_time: endTime, start_time: startTime } : {}),
  };
  const basePath = `/2/users/${userId}/liked_tweets`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);
  // context.logger.info('continuation: ' + continuation);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawTweet) => parseTweet(rawTweet, annotationInfo));
  // Weird error here using structured builder to watch out for.
  const skipContinuation = results?.map((t) => t.id).includes(lastTweetId);
  const nextUrl = nextUrlFromResponse(basePath, params, response);
  return {
    result: results || [],
    continuation: nextUrl && !skipContinuation ? { nextUrl } : undefined,
  };
}

async function getSearchTweets(
  [query, mode]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    "media.fields": CommonTweetMediaFields,
    query,
    max_results: 20,
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
    "The id, handle, or URL for a Twitter user. For example, '12312312312313' or 'spencerc99' or 'https://twitter.com/spencerc99'",
});

const queryParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "query",
  description:
    "The query for a Twitter search. See https://developer.twitter.com/en/docs/twitter-api/tweets/search/integrate/build-a-query for more info on how to build a query",
});

const lastTweetIdParameter = coda.makeParameter({
  type: coda.ParameterType.String,
  name: "lastTweetId",
  description:
    'The ID of a tweet which will filter results to everything that comes later than this tweet. If this parameter is not provided, the function will sync everything which is performance intensive. Recommended to be used in conjunction with the "keep unsynced rows" option to preserve tweet pulling quota and avoid rate limiting of your doc.',
  optional: true,
});

const dateParameter = coda.makeParameter({
  type: coda.ParameterType.Date,
  name: "date",
  description:
    'A date to filter for tweets posted on that date. If this parameter is not provided, the function will sync everything which is performance intensive. Recommended to be used in conjunction with the "keep unsynced rows" option to preserve tweet pulling quota and avoid rate limiting of your doc.',
  optional: true,
});

pack.addSyncTable({
  // The display name for the table, shown in the UI.
  name: "LikedTweets",
  // The unique identifier for the table.
  identityName: "LikedTweet",
  schema: coda.makeObjectSchema({
    ...commonTweetSchema,
    displayProperty: "url",
    identity: { name: "LikedTweet" },
  }),
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "LikedTweets",
    description: "Fetches the tweets that a given user has liked.",

    parameters: [userIdParameter, lastTweetIdParameter],

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getLikedTweets(params, context, context.sync.continuation),
  },
  // This indicates whether or not your sync table requires an account connection.
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addSyncTable({
  // The display name for the table, shown in the UI.
  name: "ProfileTweets",
  // The unique identifier for the table.
  identityName: "ProfileTweet",
  schema: coda.makeObjectSchema({
    ...commonTweetSchema,
    displayProperty: "url",
    identity: { name: "ProfileTweet" },
  }),
  formula: {
    // This is the name that will be called in the formula builder. Remember, your formula name cannot have spaces in it.
    name: "ProfileTweets",
    description: "Fetches the tweets that for a given user.",

    parameters: [userIdParameter, lastTweetIdParameter, dateParameter],

    // Everything inside this statement will execute anytime your Coda function is called in a doc.
    execute: (params, context) =>
      getProfileTweets(params, context, context.sync.continuation),
  },
  // This indicates whether or not your sync table requires an account connection.
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addSyncTable({
  name: "SearchTweets",
  identityName: "SearchTweet",
  schema: coda.makeObjectSchema({
    ...commonTweetSchema,
    displayProperty: "url",
    identity: { name: "SearchTweet" },
  }),
  formula: {
    name: "SearchTweets",
    description: "Fetches tweets for a given search query.",

    parameters: [queryParameter],

    execute: (params, context) =>
      getSearchTweets(params, context, context.sync.continuation),
  },
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addFormula({
  name: "GetUser",
  description: "Gets information about a twitter user by handle.",
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
  // TODO(spencer): make this optional after fixing bug around column format
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addFormula({
  name: "GetTweet",
  description: "Gets information about a tweet by ID or URL.",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweet",
      description: "the tweet id or URL",
    }),
  ],

  execute: getTweet,
  resultType: coda.ValueType.Object,
  schema: tweetSchema,
  // TODO(spencer): make this optional after fixing bug around column format
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addFormula({
  name: "GetDraftTweetLink",
  description: "Creates a link to draft a pre-populated tweet.",

  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "draft text",
      description:
        "The text to seed the draft with. User will be allowed the tweet to modify before posting",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      optional: true,
      name: "url",
      description:
        "Optional. A fully-qualified URL with a HTTP or HTTPS scheme. The provided URL will be shortened by Twitter’s t.co to preserve character length.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      optional: true,
      name: "via",
      description:
        "Optional. A Twitter username to associate with the Tweet, such as your site’s Twitter account. The provided username will be appended to the end of the Tweet with the text “via @username”. A logged-out Twitter user will be encouraged to sign-in or join Twitter to engage with the via account’s Tweets. The account may be suggested as an account to follow after the user posts a Tweet.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.String,
      optional: true,
      name: "in reply to",
      description: "Optional. ID of a tweet to reply to.",
    }),
    coda.makeParameter({
      type: coda.ParameterType.StringArray,
      optional: true,
      name: "hashtags",
      description:
        "Optional. Allow easy discovery of Tweets by topic by including a comma-separated list of hashtag values without the preceding # character.",
    }),
  ],

  resultType: coda.ValueType.String,
  codaType: coda.ValueHintType.Url,
  connectionRequirement: coda.ConnectionRequirement.None,

  execute: async function ([text, url, via, inReplyTo, hashtags]) {
    return coda.withQueryParams(`https://twitter.com/intent/tweet`, {
      text,
      url,
      hashtags: hashtags ? hashtags.join(",") : undefined,
      via: via ? via.replace(/@/g, "").trim() : undefined,
      in_reply_to: inReplyTo,
    });
  },
});

async function getUserFollowers(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: CommonUserExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": UserLookupFields,
    max_results: 1000,
  };
  const basePath = `/2/users/${id}/followers`;
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
    expansions: CommonUserExpansions,
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

async function getBookmarks(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    "media.fields": CommonTweetMediaFields,
  };
  const basePath = `/2/users/${id}/bookmarks`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawBookmark) =>
    parseTweet(rawBookmark, annotationInfo)
  );
  const nextUrl = nextUrlFromResponse(basePath, params, response);

  return {
    result: results || [],
    continuation: nextUrl ? { nextUrl } : undefined,
  };
}

async function getUserTimeline(
  [id]: any[],
  context: coda.ExecutionContext,
  continuation: coda.Continuation | undefined
) {
  const params = {
    expansions: CommonTweetExpansions,
    "tweet.fields": CommonTweetFields,
    "user.fields": CommonTweetUserFields,
    "media.fields": CommonTweetMediaFields,
  };
  const basePath = `/2/users/${id}/timelines/reverse_chronological`;
  let url = continuation
    ? (continuation.nextUrl as string)
    : apiUrl(basePath, params);

  const response = await context.fetcher.fetch({ method: "GET", url });

  const { data, includes } = response.body;
  const annotationInfo = includes;
  const results = data?.map((rawBookmark) =>
    parseTweet(rawBookmark, annotationInfo)
  );

  const nextUrl = nextUrlFromResponse(basePath, params, response);
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
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log(JSON.stringify(response.body, null, 2));
  return "OK";
}

pack.addSyncTable({
  name: "UserFollowers",
  identityName: "FollowerUser",
  schema: followerSchema,
  formula: {
    name: "UserFollowers",
    description: "Fetches the followers of a given user.",

    parameters: [userIdParameter],

    execute: (params, context) =>
      getUserFollowers(params, context, context.sync.continuation),
  },
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addSyncTable({
  name: "UserFollowing",
  identityName: "FollowingUser",
  schema: followingSchema,
  formula: {
    name: "UserFollowing",
    description: "Fetches the people following a given user.",

    parameters: [userIdParameter],

    execute: (params, context) =>
      getUserFollowing(params, context, context.sync.continuation),
  },
  connectionRequirement: coda.ConnectionRequirement.None,
});

pack.addColumnFormat({
  name: "User",
  formulaName: "GetUser",
  matchers: [TweetUserUrlRegex],
});

pack.addColumnFormat({
  name: "Tweet",
  formulaName: "GetTweet",
  matchers: [TweetUrlRegex],
});

pack.addFormula({
  resultType: coda.ValueType.String,
  name: "PostTweet",
  description: "Post a tweet",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweet",
      description: "The tweet to post",
    }),
  ],
  execute: postTweet,
  connectionRequirement: coda.ConnectionRequirement.Required,
  isAction: true,
  // Putting all the write scopes in the same extraOAuth to avoid making you re-auth after you use each action.
  extraOAuthScopes: OAuthScopesReadWrite,
});

/************************ */
/*        BOOKMARKS       */
/************************ */

async function bookmarkTweet(
  userId: string,
  tweetId: string,
  context: coda.ExecutionContext
): Promise<boolean> {
  const response = await context.fetcher.fetch({
    method: "POST",
    url: apiUrl(`/2/users/${userId}/bookmarks`),
    body: JSON.stringify({
      tweet_id: tweetId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return Boolean(response.body?.data.bookmarked);
}

async function removeBookmark(
  userId: string,
  tweetId: string,
  context: coda.ExecutionContext
): Promise<boolean> {
  const response = await context.fetcher.fetch({
    method: "DELETE",
    url: apiUrl(`/2/users/${userId}/bookmarks/${tweetId}`),
  });
  return Boolean(response.body?.data.bookmarked);
}

pack.addSyncTable({
  name: "Bookmarks",
  identityName: "Bookmark",
  schema: coda.makeObjectSchema({
    ...commonTweetSchema,
    displayProperty: "url",
    identity: { name: "Bookmark" },
  }),
  formula: {
    name: "Bookmarks",
    description: "Fetches the bookmarks for the authenticated user.",

    parameters: [],

    execute: async (_params, context) => {
      // first get the current authenticated user
      const response = await context.fetcher.fetch({
        url: apiUrl("/2/users/me"),
        method: "GET",
      });
      const userId = response.body?.data?.id;
      coda.ensureExists(userId, "Authenticated user not found.");

      return getBookmarks([userId], context, context.sync.continuation);
    },
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
});

pack.addSyncTable({
  name: "UserTimeline",
  identityName: "UserTimeline",
  schema: coda.makeObjectSchema({
    ...commonTweetSchema,
    displayProperty: "url",
    identity: { name: "UserTimeline" },
  }),
  formula: {
    name: "UserTimeline",
    description:
      "Fetches the reverse chronological timeline for the authenticated user.",

    parameters: [],

    execute: async (_params, context) => {
      // first get the current authenticated user
      const response = await context.fetcher.fetch({
        url: apiUrl("/2/users/me"),
        method: "GET",
      });
      const userId = response.body?.data?.id;
      coda.ensureExists(userId, "Authenticated user not found.");

      return getUserTimeline([userId], context, context.sync.continuation);
    },
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
});

pack.addFormula({
  resultType: coda.ValueType.Boolean,
  name: "BookmarkTweet",
  description: "Bookmarks a tweet",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweetId",
      description: "The ID of the tweet to bookmark",
    }),
  ],
  execute: async ([tweetId], context) => {
    // first get the current authenticated user
    const response = await context.fetcher.fetch({
      url: apiUrl("/2/users/me"),
      method: "GET",
    });
    const userId = response.body?.data?.id;
    coda.ensureExists(userId, "Authenticated user not found.");

    return bookmarkTweet(userId, tweetId, context);
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
  isAction: true,
  // Putting all the write scopes in the same extraOAuth to avoid making you re-auth after you use each action.
  extraOAuthScopes: OAuthScopesReadWrite,
});

pack.addFormula({
  resultType: coda.ValueType.Boolean,
  name: "RemoveBookmark",
  description: "Unbookmarks a tweet",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweetId",
      description: "The ID of the tweet to unbookmark",
    }),
  ],
  execute: async ([tweetId], context) => {
    // first get the current authenticated user
    const response = await context.fetcher.fetch({
      url: apiUrl("/2/users/me"),
      method: "GET",
    });
    const userId = response.body?.data?.id;
    coda.ensureExists(userId, "Authenticated user not found.");

    return removeBookmark(userId, tweetId, context);
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
  isAction: true,
  // Putting all the write scopes in the same extraOAuth to avoid making you re-auth after you use each action.
  extraOAuthScopes: OAuthScopesReadWrite,
});

async function likeTweet(
  userId: string,
  tweetId: string,
  context: coda.ExecutionContext
): Promise<boolean> {
  const response = await context.fetcher.fetch({
    method: "POST",
    url: apiUrl(`/2/users/${userId}/likes`),
    body: JSON.stringify({
      tweet_id: tweetId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return Boolean(response.body?.data.liked);
}

async function unlikeTweet(
  userId: string,
  tweetId: string,
  context: coda.ExecutionContext
): Promise<boolean> {
  const response = await context.fetcher.fetch({
    method: "DELETE",
    url: apiUrl(`/2/users/${userId}/likes/${tweetId}`),
  });
  return Boolean(response.body?.data.liked);
}

pack.addFormula({
  resultType: coda.ValueType.Boolean,
  name: "LikeTweet",
  description: "Likes a tweet",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweetId",
      description: "The ID of the tweet to bookmark",
    }),
  ],
  execute: async ([tweetId], context) => {
    // first get the current authenticated user
    const response = await context.fetcher.fetch({
      url: apiUrl("/2/users/me"),
      method: "GET",
    });
    const userId = response.body?.data?.id;
    coda.ensureExists(userId, "Authenticated user not found.");

    return likeTweet(userId, tweetId, context);
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
  isAction: true,
  // Putting all the write scopes in the same extraOAuth to avoid making you re-auth after you use each action.
  extraOAuthScopes: OAuthScopesReadWrite,
});

pack.addFormula({
  resultType: coda.ValueType.Boolean,
  name: "RemoveLike",
  description: "Removes a like from a tweet",
  parameters: [
    coda.makeParameter({
      type: coda.ParameterType.String,
      name: "tweetId",
      description: "The ID of the tweet to unlike",
    }),
  ],
  execute: async ([tweetId], context) => {
    // first get the current authenticated user
    const response = await context.fetcher.fetch({
      url: apiUrl("/2/users/me"),
      method: "GET",
    });
    const userId = response.body?.data?.id;
    coda.ensureExists(userId, "Authenticated user not found.");

    return unlikeTweet(userId, tweetId, context);
  },
  connectionRequirement: coda.ConnectionRequirement.Required,
  isAction: true,
  // Putting all the write scopes in the same extraOAuth to avoid making you re-auth after you use each action.
  extraOAuthScopes: OAuthScopesReadWrite,
});
