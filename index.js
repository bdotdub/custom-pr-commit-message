import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { default as Mustache } from 'mustache';

async function merge(octokit, trigger_phrase) {
    if (!context.payload.comment.body.includes(trigger_phrase)) {
        console.log('Comment does not contain trigger phrase');
        return;
    }

    console.log("Fetching pull request");

    const { data: pullRequest } = await octokit.rest.pulls.get({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
    });
    console.log(`Received: ${pullRequest.title} (#${pullRequest.number})`);

    if (!pullRequest.mergeable) {
        console.log(`Pull request is not mergeable, not merging`);
        // TODO: Comment on the pull request that it is not mergeable
        return;
    }

    // Check whether there are approvals
    const reviews = await octokit.rest.pulls.listReviews({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
    });

    const approvals = reviews.data.filter(review => review.state === 'APPROVED');
    if (approvals.length === 0) {
        console.log(`Pull request does not have any approvals, not merging`);
        // TODO: Comment on the pull request that it is not approved
        return;
    }

    // Check PR checks
    const checks = await octokit.rest.checks.listSuitesForRef({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        ref: pullRequest.head.sha
    });

    const failed_checks = checks.check_suites.filter(check => {
        return (
            check.status === 'completed'
            && check.conclusion === 'failure'
        )
    })

    if (failed_checks.length > 0) {
        console.log(`Some checks have failed. Not merging`);
        // TODO: Comment on the pull request that there are failed checks
        return;
    }

    const template = `{{{html_url}}}

{{{body}}}`;

    const output = Mustache.render(template, pullRequest);
    console.log("Rendered template", output);

    console.log("About to merge")

    await octokit.rest.pulls.merge({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
        commit_message: output,
        merge_method: 'squash',
    });
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

    console.log("About to delete branch")

    await octokit.rest.git.deleteRef({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        ref: `heads/${pullRequest.head.ref}`,
    });
}

const action = getInput('action');
const octokit = getOctokit(getInput('github-token'));

try {
    switch (action) {
        case 'merge':
            merge(octokit);
            break;
        case 'delete':
            delete_merged_branch(octokit);
            break;
        default:
            throw new Error(`Unknown action: ${action}`);
    }
    run()
} catch (error) {
    setFailed(error.message);
}
