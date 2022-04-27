import { getInput, setFailed, setOutput } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { default as Mustache } from "mustache";

async function isMergeable(pullRequest) {
  return pullRequest.mergeable;
}

async function isApproved(pullRequest) {
  // Check whether there are approvals
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner: pullRequest.base.repo.owner.login,
    repo: pullRequest.base.repo.name,
    pull_number: pullRequest.number,
  });

  const approvals = reviews.filter((review) => review.state === "APPROVED");
  if (approvals.length === 0) {
    return false;
  }

  return true;
}

async function haveChecksPassed(pullRequest) {
  // Check PR checks
  const { data: checks } = await octokit.rest.checks.listSuitesForRef({
    owner: pullRequest.base.repo.owner.login,
    repo: pullRequest.base.repo.name,
    ref: pullRequest.head.sha,
  });

  console.log(checks);

  const failed_checks = checks.check_suites.filter((check) => {
    return check.status === "completed" && check.conclusion === "failure";
  });

  if (failed_checks.length > 0) {
    // TODO: Comment on the pull request that there are failed checks
    return false;
  }

  return true;
}

async function renderCommitMessage(pullRequest) {
  const template = `{{{html_url}}}

{{{body}}}`;

  const output = Mustache.render(template, pullRequest);
  console.log("Rendered template", output);

  console.log("About to merge");
  return output;
}

async function merge(octokit, pullRequestIdentifiable, trigger_phrase) {
  // First, make sure there is a trigger phase
  if (!trigger_phrase || triggerPhrase.length === 0) {
    console.log("No trigger phrase specified");
    setOutput("merged", false);
    return;
  }

  // Next, check if the comment contains the trigger phrase
  console.log(
    `Checking trigger phrase: ${trigger_phrase}, ${context.payload.comment.body}`
  );
  if (!context.payload.comment.body.includes(trigger_phrase)) {
    setOutput("merged", false);
    return;
  }

  console.log("Fetching pull request");

  // Fetch the pull request
  const { data: pullRequest } = await octokit.rest.pulls.get(
    pullRequestIdentifiable
  );
  console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

  // Run through the checks
  if (!isMergeable(pullRequest)) {
    console.log(`Pull request is not mergeable, not merging`);
    setOutput("merged", false);
    return;
  }
  if (!isApproved(pullRequest)) {
    console.log(`Pull request does not have any approvals, not merging`);
    setOutput("merged", false);
    return;
  }
  if (!haveChecksPassed(pullRequest)) {
    console.log(`Some checks have failed. Not merging`);
    setOutput("merged", false);
    return;
  }

  // If everything looks good, let's generate the message
  const mergeCommitMessage = await renderCommitMessage(pullRequest);

  // Now merge it!
  const response = await octokit.rest.pulls.merge({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    pull_number: context.payload.issue.number,
    commit_message: mergeCommitMessage,
    merge_method: "squash",
  });

  // Check the result
  if (response.status == 200) {
    console.log("Merge successful");
    setOutput("merged", true);
  } else {
    setOutput("merged", false);
    setFailed(`Merge failed with status ${response.status}`);
  }
}

async function delete_merged_branch(octokit) {
  console.log("Fetching pull request");

  const { data: pullRequest } = await octokit.rest.pulls.get({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    pull_number: context.payload.issue.number,
  });
  console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

  if (!pullRequest.merged) {
    console.log(`Pull request is not merged, not deleting branch`);
    return;
  }

  console.log("About to delete branch");

  await octokit.rest.git.deleteRef({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    ref: `heads/${pullRequest.head.ref}`,
  });
}

const action = getInput("action");
const triggerPhrase = getInput("trigger-phrase");
const octokit = getOctokit(getInput("github-token"));
const pullRequestIdentifiable = {
  owner: context.payload.repository.owner.login,
  repo: context.payload.repository.name,
  pull_number: context.payload.issue.number,
};

try {
  switch (action) {
    case "merge":
      merge(octokit, pullRequestIdentifiable, triggerPhrase);
      break;
    case "delete":
      delete_merged_branch(octokit, pullRequestIdentifiable);
      break;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
} catch (error) {
  setFailed(error.message);
}
