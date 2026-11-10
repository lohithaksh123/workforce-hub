/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as central_wallet from "../central_wallet.js";
import type * as correct_db_balances from "../correct_db_balances.js";
import type * as estimation from "../estimation.js";
import type * as holiday_helper from "../holiday_helper.js";
import type * as hr_documents from "../hr_documents.js";
import type * as id_card from "../id_card.js";
import type * as invites from "../invites.js";
import type * as joinRequests from "../joinRequests.js";
import type * as leaves from "../leaves.js";
import type * as notices from "../notices.js";
import type * as notifications from "../notifications.js";
import type * as reports from "../reports.js";
import type * as requests from "../requests.js";
import type * as requirements from "../requirements.js";
import type * as roles from "../roles.js";
import type * as site_assets from "../site_assets.js";
import type * as sites from "../sites.js";
import type * as tasks from "../tasks.js";
import type * as transactions from "../transactions.js";
import type * as user_documents from "../user_documents.js";
import type * as users from "../users.js";
import type * as wallets from "../wallets.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  central_wallet: typeof central_wallet;
  correct_db_balances: typeof correct_db_balances;
  estimation: typeof estimation;
  holiday_helper: typeof holiday_helper;
  hr_documents: typeof hr_documents;
  id_card: typeof id_card;
  invites: typeof invites;
  joinRequests: typeof joinRequests;
  leaves: typeof leaves;
  notices: typeof notices;
  notifications: typeof notifications;
  reports: typeof reports;
  requests: typeof requests;
  requirements: typeof requirements;
  roles: typeof roles;
  site_assets: typeof site_assets;
  sites: typeof sites;
  tasks: typeof tasks;
  transactions: typeof transactions;
  user_documents: typeof user_documents;
  users: typeof users;
  wallets: typeof wallets;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
