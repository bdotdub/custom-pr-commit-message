import { getInput, setFailed, setOutput } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { default as Mustache } from 'mustache';

async function merge(octokit, trigger_phrase) {
    if (!trigger_phrase || triggerPhrase.length === 0) {
        console.log('No trigger phrase specified');
        setOutput("merged", false);
        return;
    }

    console.log(`Checking trigger phrase: ${trigger_phrase}, ${context.payload.comment.body}`);
    if (!context.payload.comment.body.includes(trigger_phrase)) {
        setOutput("merged", false);
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
        setOutput("merged", false);
        return;
    }

    // Check whether there are approvals
    const { data: reviews } = await octokit.rest.pulls.listReviews({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
    });

    // const approvals = reviews.filter(review => review.state === 'APPROVED');
    // if (approvals.length === 0) {
    //     console.log(`Pull request does not have any approvals, not merging`);
    //     setOutput("merged", false);
    //     // TODO: Comment on the pull request that it is not approved
    //     return;
    // }

    // Check PR checks
    const { data: checks } = await octokit.rest.checks.listSuitesForRef({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        ref: pullRequest.head.sha
    });

    console.log(checks)

    const failed_checks = checks.check_suites.filter(check => {
        return (
            check.status === 'completed'
            && check.conclusion === 'failure'
        )
    })

    if (failed_checks.length > 0) {
        console.log(`Some checks have failed. Not merging`);
        setOutput("merged", false);
        // TODO: Comment on the pull request that there are failed checks
        return;
    }

    const template = `{{{html_url}}}

{{{body}}}`;

    const output = Mustache.render(template, pullRequest);
    console.log("Rendered template", output);

    console.log("About to merge")

    const response = await octokit.rest.pulls.merge({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: context.payload.issue.number,
        commit_message: output,
        merge_method: 'squash',
    });

    if (response.status == 200) {
        console.log("Merge successful");
        setOutput('merged', true);
    } else {
        setOutput('merged', false);
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

    console.log("About to delete branch")

    await octokit.rest.git.deleteRef({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        ref: `heads/${pullRequest.head.ref}`,
    });
}

const action = getInput('action');
const triggerPhrase = getInput('trigger-phrase');
const octokit = getOctokit(getInput('github-token'));

try {
    switch (action) {
        case 'merge':
            merge(octokit, triggerPhrase);
            break;
        case 'delete':
            delete_merged_branch(octokit);
            break;
        default:
            throw new Error(`Unknown action: ${action}`);
    }
} catch (error) {
    setFailed(error.message);
}
