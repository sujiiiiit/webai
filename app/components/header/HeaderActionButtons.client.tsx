import { useStore } from "@nanostores/react";
import { toast } from "react-toastify";
import { chatStore } from "~/lib/stores/chat";
import { netlifyConnection } from "~/lib/stores/netlify";
import { vercelConnection } from "~/lib/stores/vercel";
import { workbenchStore } from "~/lib/stores/workbench";
import { webcontainer } from "~/lib/webcontainer";
import { path } from "~/utils/path";
import { useEffect, useRef, useState } from "react";
import type { ActionCallbackData } from "~/lib/runtime/message-parser";
import { chatId } from "~/lib/persistence/useChatHistory";
import { streamingState } from "~/lib/stores/streaming";
import { NetlifyDeploymentLink } from "~/components/chat/NetlifyDeploymentLink.client";
import { VercelDeploymentLink } from "~/components/chat/VercelDeploymentLink.client";
import { ChatIcon, CodeIcon, GlobeIcon, RightArrowSmall } from "../ui/icons";
import { Button } from "~/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<"netlify" | "vercel" | null>(
    null
  );
  const canHideChat = showWorkbench || !showChat;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStreaming = useStore(streamingState);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentChatId = useStore(chatId);

  const handleNetlifyDeploy = async () => {
    if (!netlifyConn.user || !netlifyConn.token) {
      toast.error("Please connect to Netlify first in the settings tab!");
      return;
    }

    if (!currentChatId) {
      toast.error("No active chat found");
      return;
    }

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error("No active project found");
      }

      const actionId = "build-" + Date.now();
      const actionData: ActionCallbackData = {
        messageId: "netlify build",
        artifactId: artifact.id,
        actionId,
        action: {
          type: "build" as const,
          content: "npm run build",
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        throw new Error("Build failed");
      }

      // Get the build files
      const container = await webcontainer;

      // Remove /home/project from buildPath if it exists
      const buildPath = artifact.runner.buildOutput.path.replace(
        "/home/project",
        ""
      );

      // Get all files recursively
      async function getAllFiles(
        dirPath: string
      ): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, "utf-8");

            // Remove /dist prefix from the path
            const deployPath = fullPath.replace(buildPath, "");
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(buildPath);

      // Use chatId instead of artifact.id
      const existingSiteId = localStorage.getItem(
        `netlify-site-${currentChatId}`
      );

      // Deploy using the API route with file contents
      const response = await fetch("/api/netlify-deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId: existingSiteId || undefined,
          files: fileContents,
          token: netlifyConn.token,
          chatId: currentChatId, // Use chatId instead of artifact.id
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.deploy || !data.site) {
        console.error("Invalid deploy response:", data);
        throw new Error(data.error || "Invalid deployment response");
      }

      // Poll for deployment status
      const maxAttempts = 20; // 2 minutes timeout
      let attempts = 0;
      let deploymentStatus;

      while (attempts < maxAttempts) {
        try {
          const statusResponse = await fetch(
            `https://api.netlify.com/api/v1/sites/${data.site.id}/deploys/${data.deploy.id}`,
            {
              headers: {
                Authorization: `Bearer ${netlifyConn.token}`,
              },
            }
          );

          deploymentStatus = (await statusResponse.json()) as any;

          if (
            deploymentStatus.state === "ready" ||
            deploymentStatus.state === "uploaded"
          ) {
            break;
          }

          if (deploymentStatus.state === "error") {
            throw new Error(
              "Deployment failed: " +
                (deploymentStatus.error_message || "Unknown error")
            );
          }

          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error("Status check error:", error);
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error("Deployment timed out");
      }

      // Store the site ID if it's a new site
      if (data.site) {
        localStorage.setItem(`netlify-site-${currentChatId}`, data.site.id);
      }

      toast.success(
        <div>
          Deployed successfully!{" "}
          <a
            href={deploymentStatus.ssl_url || deploymentStatus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View site
          </a>
        </div>
      );
    } catch (error) {
      console.error("Deploy error:", error);
      toast.error(error instanceof Error ? error.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleVercelDeploy = async () => {
    if (!vercelConn.user || !vercelConn.token) {
      toast.error("Please connect to Vercel first in the settings tab!");
      return;
    }

    if (!currentChatId) {
      toast.error("No active chat found");
      return;
    }

    try {
      setIsDeploying(true);
      setDeployingTo("vercel");

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        throw new Error("No active project found");
      }

      const actionId = "build-" + Date.now();
      const actionData: ActionCallbackData = {
        messageId: "vercel build",
        artifactId: artifact.id,
        actionId,
        action: {
          type: "build" as const,
          content: "npm run build",
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        throw new Error("Build failed");
      }

      // Get the build files
      const container = await webcontainer;

      // Remove /home/project from buildPath if it exists
      const buildPath = artifact.runner.buildOutput.path.replace(
        "/home/project",
        ""
      );

      // Get all files recursively
      async function getAllFiles(
        dirPath: string
      ): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, "utf-8");

            // Remove /dist prefix from the path
            const deployPath = fullPath.replace(buildPath, "");
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(buildPath);

      // Use chatId instead of artifact.id
      const existingProjectId = localStorage.getItem(
        `vercel-project-${currentChatId}`
      );

      // Deploy using the API route with file contents
      const response = await fetch("/api/vercel-deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: existingProjectId || undefined,
          files: fileContents,
          token: vercelConn.token,
          chatId: currentChatId,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok || !data.deploy || !data.project) {
        console.error("Invalid deploy response:", data);
        throw new Error(data.error || "Invalid deployment response");
      }

      // Store the project ID if it's a new project
      if (data.project) {
        localStorage.setItem(
          `vercel-project-${currentChatId}`,
          data.project.id
        );
      }

      toast.success(
        <div>
          Deployed successfully to Vercel!{" "}
          <a
            href={data.deploy.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View site
          </a>
        </div>
      );
    } catch (error) {
      console.error("Vercel deploy error:", error);
      toast.error(
        error instanceof Error ? error.message : "Vercel deployment failed"
      );
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  return (
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
            size={'sm'}
            variant={"outline"}
              // disabled={isDeploying || !activePreview || isStreaming}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="text-xs "
            >
              <GlobeIcon className="text-color-secondary" size={16} />
              {isDeploying ? `Deploying to ${deployingTo}...` : "Deploy"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => {
                handleNetlifyDeploy();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview || !netlifyConn.user}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
              />
              <span className="mx-auto">
                {!netlifyConn.user
                  ? "No Netlify Account Connected"
                  : "Deploy to Netlify"}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isDeploying || !activePreview || !vercelConn.user}
              onClick={() => {
                handleVercelDeploy();
                setIsDropdownOpen(false);
              }}
            >
              <img
                className="w-5 h-5 bg-black p-1 rounded"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/vercel/white"
                alt="vercel"
              />
              <span className="mx-auto">
                {!vercelConn.user
                  ? "No Vercel Account Connected"
                  : "Deploy to Vercel"}
              </span>
              {vercelConn.user && <VercelDeploymentLink />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    );
}
