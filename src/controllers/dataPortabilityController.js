"use strict";

const xlsx = require("xlsx");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

// Helper to format date strings
function formatDate(date) {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

// Helper to lowercase the first letter of a string
function lowerFirst(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

// Default headers for templates if a sheet is empty
const defaultUsersHeaders = ["ID", "Username", "Email", "Role", "Status", "Created_At"];
const defaultTeamsHeaders = ["ID", "Name", "Description", "Status", "Team_Lead", "Created_At"];
const defaultProjectsHeaders = ["ID", "Name", "Type", "Status", "Priority", "Description", "Scope", "Start_Date", "End_Date", "Project_Manager", "Created_At"];
const defaultTasksHeaders = ["ID", "Title", "Description", "Status", "Priority", "Project_Name", "Creator", "Assignees", "Due_Date", "Estimated_Hours", "Actual_Hours", "Created_At"];
const defaultSubtasksHeaders = ["ID", "Title", "Description", "Status", "Priority", "Parent_Task_Title", "Assigned_To", "Estimated_Hours", "Actual_Hours", "Created_At"];
const defaultTimeLogsHeaders = ["ID", "Hours_Logged", "Description", "Log_Date", "Username", "Task_Title", "Created_At"];

// Helper to convert array to sheet, and automatically populate sample headers/values if empty
function arrayToSheetWithTemplate(rows, headers) {
  if (!rows || rows.length === 0) {
    const templateRow = {};
    headers.forEach(h => {
      templateRow[h] = "";
    });
    // Add sample values for guidance
    if (headers.includes("Username")) {
      templateRow["Username"] = "john_doe";
      templateRow["Email"] = "john@example.com";
      templateRow["Role"] = "developer";
      templateRow["Status"] = "Active";
    } else if (headers.includes("Team_Lead")) {
      templateRow["Name"] = "Engineering Team";
      templateRow["Description"] = "Core software development group";
      templateRow["Status"] = "active";
      templateRow["Team_Lead"] = "admin";
    } else if (headers.includes("Project_Manager")) {
      templateRow["Name"] = "Qeema Website Redesign";
      templateRow["Type"] = "software_development";
      templateRow["Status"] = "planned";
      templateRow["Priority"] = "high";
      templateRow["Project_Manager"] = "admin";
    } else if (headers.includes("Project_Name")) {
      templateRow["Title"] = "Design Frontend Wireframes";
      templateRow["Description"] = "Create figma mocks";
      templateRow["Status"] = "in_progress";
      templateRow["Priority"] = "high";
      templateRow["Project_Name"] = "Qeema Website Redesign";
      templateRow["Creator"] = "admin";
    } else if (headers.includes("Parent_Task_Title")) {
      templateRow["Title"] = "Figma Drafts";
      templateRow["Parent_Task_Title"] = "Design Frontend Wireframes";
      templateRow["Status"] = "pending";
    }
    return xlsx.utils.json_to_sheet([templateRow]);
  }
  return xlsx.utils.json_to_sheet(rows);
}

/**
 * Excel Export Controller
 * Exports requested models (or all models) into a template-safe Excel file.
 */
async function exportExcel(req, res, next) {
  try {
    let { model } = req.query || {}; // projects | tasks | users | teams

    // Fallback: If model is not explicitly specified, inspect the Referer header to determine the page context
    if (!model && req.headers && req.headers.referer) {
      const referer = req.headers.referer.toLowerCase();
      if (referer.includes("/projects")) {
        model = "projects";
      } else if (referer.includes("/tasks")) {
        model = "tasks";
      } else if (referer.includes("/teams")) {
        model = "teams";
      } else if (referer.includes("/users")) {
        model = "users";
      }
    }

    const id = req.query?.id ? parseInt(req.query.id) : null;

    let usersWhere = undefined;
    let teamsWhere = undefined;
    let projectsWhere = undefined;
    let tasksWhere = undefined;
    let subtasksWhere = undefined;
    let timeLogsWhere = undefined;

    if (id) {
      const lowerModel = (model || "").toLowerCase();
      if (lowerModel === "projects") {
        projectsWhere = { id };
        tasksWhere = { projectId: id };
        subtasksWhere = { parentTask: { projectId: id } };
        timeLogsWhere = { task: { projectId: id } };
        teamsWhere = { projectTeams: { some: { projectId: id } } };
        usersWhere = {
          OR: [
            { projectsManaged: { some: { id } } },
            { assignedTasks: { some: { projectId: id } } },
            { tasksCreated: { some: { projectId: id } } },
            { assignedSubtasks: { some: { parentTask: { projectId: id } } } },
            { timeLogs: { some: { task: { projectId: id } } } }
          ]
        };
      } else if (lowerModel === "tasks") {
        tasksWhere = { id };
        subtasksWhere = { parentTaskId: id };
        timeLogsWhere = { taskId: id };
        projectsWhere = { tasks: { some: { id } } };
        usersWhere = {
          OR: [
            { tasksCreated: { some: { id } } },
            { assignedTasks: { some: { id } } },
            { assignedSubtasks: { some: { parentTaskId: id } } },
            { timeLogs: { some: { taskId: id } } }
          ]
        };
      } else if (lowerModel === "teams") {
        teamsWhere = { id };
        usersWhere = {
          OR: [
            { teamId: id },
            { teamsLed: { some: { id } } },
            { teamMemberships: { some: { teamId: id } } }
          ]
        };
        projectsWhere = { projectTeams: { some: { teamId: id } } };
        tasksWhere = { project: { projectTeams: { some: { teamId: id } } } };
        subtasksWhere = { parentTask: { project: { projectTeams: { some: { teamId: id } } } } };
        timeLogsWhere = { user: { OR: [ { teamId: id }, { teamMemberships: { some: { teamId: id } } } ] } };
      } else if (lowerModel === "users") {
        usersWhere = { id };
        teamsWhere = {
          OR: [
            { teamLeadId: id },
            { members: { some: { userId: id } } },
            { users: { some: { id } } }
          ]
        };
        projectsWhere = {
          OR: [
            { projectManagerId: id },
            { createdById: id },
            { projectTeams: { some: { team: { OR: [ { teamLeadId: id }, { members: { some: { userId: id } } } ] } } } },
            { tasks: { some: { OR: [ { createdById: id }, { assignees: { some: { id } } } ] } } }
          ]
        };
        tasksWhere = {
          OR: [
            { createdById: id },
            { assignees: { some: { id } } }
          ]
        };
        subtasksWhere = {
          OR: [
            { createdById: id },
            { assignedToId: id }
          ]
        };
        timeLogsWhere = { userId: id };
      }
    }

    // 1. Fetch Users
    const users = await prisma.user.findMany({
      where: usersWhere,
      orderBy: { id: "asc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    const usersRows = users.map(u => ({
      ID: u.id,
      Username: u.username,
      Email: u.email,
      Role: u.role,
      Status: u.isActive ? "Active" : "Inactive",
      Created_At: formatDate(u.createdAt),
    }));

    // 2. Fetch Teams
    const teams = await prisma.team.findMany({
      where: teamsWhere,
      orderBy: { id: "asc" },
      include: {
        teamLead: { select: { username: true } },
      },
    });
    const teamsRows = teams.map(t => ({
      ID: t.id,
      Name: t.name,
      Description: t.description || "",
      Status: t.status,
      Team_Lead: t.teamLead?.username || "",
      Created_At: formatDate(t.createdAt),
    }));

    // 3. Fetch Projects
    const projects = await prisma.project.findMany({
      where: projectsWhere,
      orderBy: { id: "asc" },
      include: {
        projectManager: { select: { username: true } },
        projectType: { select: { name: true } },
        projectStatus: { select: { name: true } },
      },
    });
    const projectsRows = projects.map(p => ({
      ID: p.id,
      Name: p.name,
      Type: p.projectType?.name || "",
      Status: p.projectStatus?.name || "",
      Priority: p.priority,
      Description: p.description || "",
      Scope: p.scope || "",
      Start_Date: formatDate(p.startDate),
      End_Date: formatDate(p.endDate),
      Project_Manager: p.projectManager?.username || "",
      Created_At: formatDate(p.createdAt),
    }));

    // 4. Fetch Tasks
    const tasks = await prisma.task.findMany({
      where: tasksWhere,
      orderBy: { id: "asc" },
      include: {
        project: { select: { name: true } },
        creator: { select: { username: true } },
        taskStatus: { select: { name: true } },
        assignees: { select: { username: true } },
      },
    });
    const tasksRows = tasks.map(t => ({
      ID: t.id,
      Title: t.title,
      Description: t.description || "",
      Status: t.taskStatus?.name || "",
      Priority: t.priority,
      Project_Name: t.project?.name || "",
      Creator: t.creator?.username || "",
      Assignees: t.assignees.map(a => a.username).join(", "),
      Due_Date: formatDate(t.dueDate),
      Estimated_Hours: t.estimatedHours,
      Actual_Hours: t.actualHours,
      Created_At: formatDate(t.createdAt),
    }));

    // 5. Fetch Subtasks
    const subtasks = await prisma.subtask.findMany({
      where: subtasksWhere,
      orderBy: { id: "asc" },
      include: {
        parentTask: { select: { title: true } },
        assignedTo: { select: { username: true } },
      },
    });
    const subtasksRows = subtasks.map(s => ({
      ID: s.id,
      Title: s.title,
      Description: s.description || "",
      Status: s.status,
      Priority: s.priority,
      Parent_Task_Title: s.parentTask?.title || "",
      Assigned_To: s.assignedTo?.username || "",
      Estimated_Hours: s.estimatedHours,
      Actual_Hours: s.actualHours,
      Created_At: formatDate(s.createdAt),
    }));

    // 6. Fetch Time Logs
    const timeLogs = await prisma.timeLog.findMany({
      where: timeLogsWhere,
      orderBy: { id: "asc" },
      include: {
        user: { select: { username: true } },
        task: { select: { title: true } },
      },
    });
    const timeLogsRows = timeLogs.map(l => ({
      ID: l.id,
      Hours_Logged: l.hoursLogged,
      Description: l.description || "",
      Log_Date: formatDate(l.logDate),
      Username: l.user?.username || "",
      Task_Title: l.task?.title || "",
      Created_At: formatDate(l.createdAt),
    }));

    // Create workbook using exceljs
    const wb = new ExcelJS.Workbook();

    // Contextual filtering and sheet ordering based on requested model
    const sheets = [
      { name: "Users", rows: usersRows, headers: defaultUsersHeaders },
      { name: "Teams", rows: teamsRows, headers: defaultTeamsHeaders },
      { name: "Projects", rows: projectsRows, headers: defaultProjectsHeaders },
      { name: "Tasks", rows: tasksRows, headers: defaultTasksHeaders },
      { name: "Subtasks", rows: subtasksRows, headers: defaultSubtasksHeaders },
      { name: "TimeLogs", rows: timeLogsRows, headers: defaultTimeLogsHeaders }
    ];

    if (model) {
      const modelNameMap = {
        users: "Users",
        teams: "Teams",
        projects: "Projects",
        tasks: "Tasks",
        subtasks: "Subtasks",
        timelogs: "TimeLogs"
      };
      const primarySheetName = modelNameMap[model.toLowerCase()];
      if (primarySheetName) {
        sheets.sort((a, b) => {
          if (a.name === primarySheetName) return -1;
          if (b.name === primarySheetName) return 1;
          return 0;
        });
      }
    }

    const addedWorksheets = {};

    // Append sheets in order
    sheets.forEach(sheet => {
      const ws = wb.addWorksheet(sheet.name);
      addedWorksheets[sheet.name] = ws;

      // Define columns
      ws.columns = sheet.headers.map(h => ({ header: h, key: h, width: 22 }));

      let finalRows = [...sheet.rows];

      // If empty, generate a template row with guidance/sample values
      if (finalRows.length === 0) {
        const templateRow = {};
        sheet.headers.forEach(h => {
          templateRow[h] = "";
        });

        if (sheet.headers.includes("Username")) {
          templateRow["Username"] = "john_doe";
          templateRow["Email"] = "john@example.com";
          templateRow["Role"] = "developer";
          templateRow["Status"] = "Active";
        } else if (sheet.headers.includes("Team_Lead")) {
          templateRow["Name"] = "Engineering Team";
          templateRow["Description"] = "Core software development group";
          templateRow["Status"] = "active";
          templateRow["Team_Lead"] = "admin";
        } else if (sheet.headers.includes("Project_Manager")) {
          templateRow["Name"] = "Qeema Website Redesign";
          templateRow["Type"] = "software_development";
          templateRow["Status"] = "planned";
          templateRow["Priority"] = "high";
          templateRow["Project_Manager"] = "admin";
        } else if (sheet.headers.includes("Project_Name")) {
          templateRow["Title"] = "Design Frontend Wireframes";
          templateRow["Description"] = "Create figma mocks";
          templateRow["Status"] = "in_progress";
          templateRow["Priority"] = "high";
          templateRow["Project_Name"] = "Qeema Website Redesign";
          templateRow["Creator"] = "admin";
        } else if (sheet.headers.includes("Parent_Task_Title")) {
          templateRow["Title"] = "Figma Drafts";
          templateRow["Parent_Task_Title"] = "Design Frontend Wireframes";
          templateRow["Status"] = "pending";
        }
        finalRows.push(templateRow);
      }

      ws.addRows(finalRows);
    });

    // Helper to inject cell data validations to rows 2-200 for a column key
    function applyValidationByHeader(ws, headerName, formulaStr) {
      const colIndex = ws.columns.findIndex(c => c.key === headerName);
      if (colIndex === -1) return;
      const colNumber = colIndex + 1;
      for (let rowNum = 2; rowNum <= 200; rowNum++) {
        ws.getCell(rowNum, colNumber).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formulaStr],
          showErrorMessage: true,
          errorTitle: "Invalid Value",
          error: "Please select a valid option from the dropdown list."
        };
      }
    }

    // Apply validation dropdowns
    if (addedWorksheets["Users"]) {
      applyValidationByHeader(addedWorksheets["Users"], "Role", '"admin,developer,manager,client"');
      applyValidationByHeader(addedWorksheets["Users"], "Status", '"Active,Inactive"');
    }
    if (addedWorksheets["Teams"]) {
      applyValidationByHeader(addedWorksheets["Teams"], "Status", '"active,inactive"');
      applyValidationByHeader(addedWorksheets["Teams"], "Team_Lead", '=Users!$B$2:$B$200');
    }
    if (addedWorksheets["Projects"]) {
      applyValidationByHeader(addedWorksheets["Projects"], "Status", '"planned,active,on_hold,completed,cancelled"');
      applyValidationByHeader(addedWorksheets["Projects"], "Priority", '"normal,high,urgent"');
      applyValidationByHeader(addedWorksheets["Projects"], "Project_Manager", '=Users!$B$2:$B$200');
    }
    if (addedWorksheets["Tasks"]) {
      applyValidationByHeader(addedWorksheets["Tasks"], "Status", '"pending,in_progress,completed,waiting,cancelled"');
      applyValidationByHeader(addedWorksheets["Tasks"], "Priority", '"normal,high,urgent"');
      applyValidationByHeader(addedWorksheets["Tasks"], "Project_Name", '=Projects!$B$2:$B$200');
      applyValidationByHeader(addedWorksheets["Tasks"], "Creator", '=Users!$B$2:$B$200');
      applyValidationByHeader(addedWorksheets["Tasks"], "Assignees", '=Users!$B$2:$B$200');
    }
    if (addedWorksheets["Subtasks"]) {
      applyValidationByHeader(addedWorksheets["Subtasks"], "Status", '"pending,in_progress,completed,waiting,cancelled"');
      applyValidationByHeader(addedWorksheets["Subtasks"], "Priority", '"normal,high,urgent"');
      applyValidationByHeader(addedWorksheets["Subtasks"], "Parent_Task_Title", '=Tasks!$B$2:$B$200');
      applyValidationByHeader(addedWorksheets["Subtasks"], "Assigned_To", '=Users!$B$2:$B$200');
    }
    if (addedWorksheets["TimeLogs"]) {
      applyValidationByHeader(addedWorksheets["TimeLogs"], "Username", '=Users!$B$2:$B$200');
      applyValidationByHeader(addedWorksheets["TimeLogs"], "Task_Title", '=Tasks!$B$2:$B$200');
    }

    // Write buffer using exceljs
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader("Content-Disposition", `attachment; filename="qeema_${model || "database"}_export.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (err) {
    next(err);
  }
}

/**
 * Excel Import Controller
 * Parses Excel worksheet payload, maps values, performs relational mappings, and updates DB.
 */
async function importExcel(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  const results = {
    users: { created: 0, updated: 0, errors: [] },
    teams: { created: 0, updated: 0, errors: [] },
    projects: { created: 0, updated: 0, errors: [] },
    tasks: { created: 0, updated: 0, errors: [] },
    subtasks: { created: 0, updated: 0, errors: [] },
  };

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;

    // Helper map to cache usernames/IDs to avoid redundant DB queries
    const userCache = {};
    const teamCache = {};
    const projectCache = {};
    const taskCache = {};

    // Generate default password hash
    const defaultPasswordHash = await bcrypt.hash("Welcome@Qeema2026", 10);

    // 1. IMPORT USERS
    if (sheetNames.includes("Users")) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Users"]);
      for (const row of rows) {
        try {
          const username = String(row.Username || "").trim();
          const email = String(row.Email || "").trim();
          const role = String(row.Role || "developer").trim().toLowerCase();
          const statusVal = String(row.Status || "").trim().toLowerCase();
          const isActive = statusVal === "active" || statusVal === "true";

          if (!username || !email) {
            results.users.errors.push(`Row missing username or email: ${JSON.stringify(row)}`);
            continue;
          }

          // Check if user exists
          const existing = await prisma.user.findFirst({
            where: { OR: [{ username }, { email }] },
          });

          if (existing) {
            const updated = await prisma.user.update({
              where: { id: existing.id },
              data: { role, isActive },
            });
            userCache[username] = updated.id;
            results.users.updated++;
          } else {
            const created = await prisma.user.create({
              data: {
                username,
                email,
                role,
                isActive,
                passwordHash: defaultPasswordHash,
              },
            });
            userCache[username] = created.id;
            results.users.created++;
          }
        } catch (e) {
          results.users.errors.push(`Error importing user ${row.Username}: ${e.message}`);
        }
      }
    }

    // Cache pre-existing users just in case they weren't in the sheet
    const dbUsers = await prisma.user.findMany({ select: { id: true, username: true } });
    dbUsers.forEach(u => {
      userCache[u.username] = u.id;
    });

    // 2. IMPORT TEAMS
    if (sheetNames.includes("Teams")) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Teams"]);
      for (const row of rows) {
        try {
          const name = String(row.Name || "").trim();
          const description = row.Description ? String(row.Description).trim() : null;
          const status = String(row.Status || "active").trim().toLowerCase();
          const leadUsername = row.Team_Lead ? String(row.Team_Lead).trim() : null;

          if (!name) {
            results.teams.errors.push(`Row missing team name: ${JSON.stringify(row)}`);
            continue;
          }

          let teamLeadId = null;
          if (leadUsername && userCache[leadUsername]) {
            teamLeadId = userCache[leadUsername];
          }

          const existing = await prisma.team.findFirst({
            where: { name },
          });

          if (existing) {
            const updated = await prisma.team.update({
              where: { id: existing.id },
              data: { description, status, teamLeadId },
            });
            teamCache[name] = updated.id;
            results.teams.updated++;
          } else {
            const created = await prisma.team.create({
              data: { name, description, status, teamLeadId },
            });
            teamCache[name] = created.id;
            results.teams.created++;
          }
        } catch (e) {
          results.teams.errors.push(`Error importing team ${row.Name}: ${e.message}`);
        }
      }
    }

    const dbTeams = await prisma.team.findMany({ select: { id: true, name: true } });
    dbTeams.forEach(t => {
      teamCache[t.name] = t.id;
    });

    // 3. IMPORT PROJECTS
    if (sheetNames.includes("Projects")) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Projects"]);
      for (const row of rows) {
        try {
          const name = String(row.Name || "").trim();
          const typeName = String(row.Type || "software_development").trim();
          const statusName = String(row.Status || "planned").trim();
          const priority = String(row.Priority || "normal").trim().toLowerCase();
          const description = row.Description ? String(row.Description).trim() : null;
          const scope = row.Scope ? String(row.Scope).trim() : null;
          const pmUsername = row.Project_Manager ? String(row.Project_Manager).trim() : null;
          const startDate = row.Start_Date ? new Date(row.Start_Date) : null;
          const endDate = row.End_Date ? new Date(row.End_Date) : null;

          if (!name) {
            results.projects.errors.push(`Row missing project name: ${JSON.stringify(row)}`);
            continue;
          }

          let projectManagerId = null;
          if (pmUsername && userCache[pmUsername]) {
            projectManagerId = userCache[pmUsername];
          }

          // Resolve Project Type
          let projectTypeId = null;
          const existingType = await prisma.projectType.findFirst({
            where: { name: typeName },
          });
          if (existingType) {
            projectTypeId = existingType.id;
          } else {
            const newType = await prisma.projectType.create({
              data: { name: typeName, description: `Imported via Data Hub` },
            });
            projectTypeId = newType.id;
          }

          // Resolve Project Status
          let projectStatusId = null;
          const existingStatus = await prisma.projectStatus.findFirst({
            where: { name: statusName },
          });
          if (existingStatus) {
            projectStatusId = existingStatus.id;
          } else {
            const newStatus = await prisma.projectStatus.create({
              data: { name: statusName, color: "#6b7280" },
            });
            projectStatusId = newStatus.id;
          }

          const existing = await prisma.project.findFirst({
            where: { name },
          });

          const projectData = {
            name,
            projectType: projectTypeId ? { connect: { id: projectTypeId } } : undefined,
            projectStatus: projectStatusId ? { connect: { id: projectStatusId } } : undefined,
            priority,
            description,
            scope: scope,
            startDate,
            endDate,
            projectManager: projectManagerId ? { connect: { id: projectManagerId } } : undefined,
          };

          if (existing) {
            const updated = await prisma.project.update({
              where: { id: existing.id },
              data: projectData,
            });
            projectCache[name] = updated.id;
            results.projects.updated++;
          } else {
            const created = await prisma.project.create({
              data: projectData,
            });
            projectCache[name] = created.id;
            results.projects.created++;
          }
        } catch (e) {
          results.projects.errors.push(`Error importing project ${row.Name}: ${e.message}`);
        }
      }
    }

    const dbProjects = await prisma.project.findMany({ select: { id: true, name: true } });
    dbProjects.forEach(p => {
      projectCache[p.name] = p.id;
    });

    // 4. IMPORT TASKS
    if (sheetNames.includes("Tasks")) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Tasks"]);
      for (const row of rows) {
        try {
          const title = String(row.Title || "").trim();
          const description = row.Description ? String(row.Description).trim() : null;
          const statusName = String(row.Status || "pending").trim();
          const priority = String(row.Priority || "normal").trim().toLowerCase();
          const projectName = String(row.Project_Name || "").trim();
          const creatorUsername = row.Creator ? String(row.Creator).trim() : null;
          const assigneesString = row.Assignees ? String(row.Assignees).trim() : "";
          const dueDate = row.Due_Date ? new Date(row.Due_Date) : null;
          const estHours = row.Estimated_Hours ? parseFloat(row.Estimated_Hours) : 0.0;
          const actHours = row.Actual_Hours ? parseFloat(row.Actual_Hours) : 0.0;

          if (!title || !projectName) {
            results.tasks.errors.push(`Row missing title or project name: ${JSON.stringify(row)}`);
            continue;
          }

          // Resolve project
          const projectId = projectCache[projectName];
          if (!projectId) {
            results.tasks.errors.push(`Could not resolve project named '${projectName}' for task '${title}'`);
            continue;
          }

          // Resolve creator
          let createdById = null;
          if (creatorUsername && userCache[creatorUsername]) {
            createdById = userCache[creatorUsername];
          }

          // Resolve Task Status
          let taskStatusId = null;
          const existingStatus = await prisma.taskStatus.findFirst({
            where: { name: statusName },
          });
          if (existingStatus) {
            taskStatusId = existingStatus.id;
          } else {
            const newStatus = await prisma.taskStatus.create({
              data: { name: statusName, color: "#6b7280" },
            });
            taskStatusId = newStatus.id;
          }

          // Resolve Assignees
          const assigneeUsernames = assigneesString
            .split(",")
            .map(n => n.trim())
            .filter(Boolean);
          const assigneeConnects = [];
          for (const username of assigneeUsernames) {
            if (userCache[username]) {
              assigneeConnects.push({ id: userCache[username] });
            }
          }

          // Check if task exists in this project
          const existing = await prisma.task.findFirst({
            where: { title, projectId },
          });

          const taskData = {
            title,
            description,
            taskStatusId,
            priority,
            projectId,
            createdById,
            dueDate,
            estimatedHours: estHours,
            actualHours: actHours,
            assignees: {
              set: assigneeConnects, // set replaces the task assignees with the mapped users
            },
          };

          if (existing) {
            const updated = await prisma.task.update({
              where: { id: existing.id },
              data: taskData,
            });
            taskCache[title] = updated.id;
            results.tasks.updated++;
          } else {
            const created = await prisma.task.create({
              data: taskData,
            });
            taskCache[title] = created.id;
            results.tasks.created++;
          }
        } catch (e) {
          results.tasks.errors.push(`Error importing task ${row.Title}: ${e.message}`);
        }
      }
    }

    const dbTasks = await prisma.task.findMany({ select: { id: true, title: true } });
    dbTasks.forEach(t => {
      taskCache[t.title] = t.id;
    });

    // 5. IMPORT SUBTASKS
    if (sheetNames.includes("Subtasks")) {
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets["Subtasks"]);
      for (const row of rows) {
        try {
          const title = String(row.Title || "").trim();
          const description = row.Description ? String(row.Description).trim() : null;
          const status = String(row.Status || "pending").trim();
          const priority = String(row.Priority || "normal").trim().toLowerCase();
          const parentTaskTitle = String(row.Parent_Task_Title || "").trim();
          const assignedUsername = row.Assigned_To ? String(row.Assigned_To).trim() : null;
          const estHours = row.Estimated_Hours ? parseFloat(row.Estimated_Hours) : 0.0;
          const actHours = row.Actual_Hours ? parseFloat(row.Actual_Hours) : 0.0;

          if (!title || !parentTaskTitle) {
            results.subtasks.errors.push(`Row missing title or parent task title: ${JSON.stringify(row)}`);
            continue;
          }

          const parentTaskId = taskCache[parentTaskTitle];
          if (!parentTaskId) {
            results.subtasks.errors.push(`Could not resolve parent task '${parentTaskTitle}' for subtask '${title}'`);
            continue;
          }

          let assignedToId = null;
          if (assignedUsername && userCache[assignedUsername]) {
            assignedToId = userCache[assignedUsername];
          }

          // Check if exists
          const existing = await prisma.subtask.findFirst({
            where: { title, parentTaskId },
          });

          // Fetch project creator/admin as fallback subtask creator
          const defaultCreator = await prisma.user.findFirst({ where: { role: "admin" } });
          const createdById = defaultCreator ? defaultCreator.id : 1;

          const subtaskData = {
            title,
            description,
            status,
            priority,
            parentTaskId,
            assignedToId,
            estimatedHours: estHours,
            actualHours: actHours,
            createdById,
          };

          if (existing) {
            await prisma.subtask.update({
              where: { id: existing.id },
              data: subtaskData,
            });
            results.subtasks.updated++;
          } else {
            await prisma.subtask.create({
              data: subtaskData,
            });
            results.subtasks.created++;
          }
        } catch (e) {
          results.subtasks.errors.push(`Error importing subtask ${row.Title}: ${e.message}`);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Data import completed successfully.",
      results,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PDF Export Controller
 * Generates a clean PDF snapshot of the selected model (or all models)
 */
async function exportPDF(req, res, next) {
  try {
    let { model } = req.query || {}; // e.g. "projects", "tasks", "users", "teams"

    // Fallback: If model is not explicitly specified, inspect the Referer header to determine the page context
    if (!model && req.headers && req.headers.referer) {
      const referer = req.headers.referer.toLowerCase();
      if (referer.includes("/projects")) {
        model = "projects";
      } else if (referer.includes("/tasks")) {
        model = "tasks";
      } else if (referer.includes("/teams")) {
        model = "teams";
      } else if (referer.includes("/users")) {
        model = "users";
      }
    }

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Disposition", `attachment; filename="qeema_${model || "database"}_snapshot.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    // Document Header
    doc.fillColor("#1e3a8a").fontSize(20).text("QEEMA TECH MANAGEMENT SYSTEM", { align: "center" });
    doc.fillColor("#6b7280").fontSize(10).text(`DATABASE SNAPSHOT: ${String(model || "ALL").toUpperCase()}`, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    // Draw lines & tables depending on the requested model
    const renderTable = (title, headers, rows, colWidths) => {
      console.log("renderTable title:", title, "x:", doc.x, "y:", doc.y, "height:", doc.page.height);
      doc.fillColor("#1e3a8a").fontSize(14).text(title, { underline: true });
      doc.moveDown(0.5);

      const startX = doc.x;
      let startY = doc.y;

      // Draw Header background
      doc.rect(startX, startY, colWidths.reduce((a, b) => a + b, 0), 20).fill("#2563eb");

      // Draw Header Text
      doc.fillColor("#ffffff").fontSize(9);
      let currX = startX;
      headers.forEach((h, idx) => {
        doc.text(h, currX + 4, startY + 5, { width: colWidths[idx] - 8, height: 12 });
        currX += colWidths[idx];
      });

      startY += 20;
      doc.fillColor("#334155");

      rows.forEach((row, rowIdx) => {
        // Page break safety check
        if (startY > doc.page.height - 80) {
          doc.addPage();
          startY = 40;
          // Re-draw header on new page
          doc.rect(startX, startY, colWidths.reduce((a, b) => a + b, 0), 20).fill("#2563eb");
          doc.fillColor("#ffffff").fontSize(9);
          let nX = startX;
          headers.forEach((h, idx) => {
            doc.text(h, nX + 4, startY + 5, { width: colWidths[idx] - 8, height: 12 });
            nX += colWidths[idx];
          });
          startY += 20;
          doc.fillColor("#334155");
        }

        // Draw Row Background (alternating colors)
        if (rowIdx % 2 === 1) {
          doc.rect(startX, startY, colWidths.reduce((a, b) => a + b, 0), 18).fill("#f8fafc");
          doc.fillColor("#334155");
        }

        let rX = startX;
        row.forEach((cell, cellIdx) => {
          doc.text(String(cell || ""), rX + 4, startY + 4, {
            width: colWidths[cellIdx] - 8,
            height: 12,
            ellipsis: true,
          });
          rX += colWidths[cellIdx];
        });

        // Draw row bottom border
        doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(startX, startY + 18).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), startY + 18).stroke();

        startY += 18;
      });

      doc.x = startX;
      doc.y = startY + 15;
      doc.moveDown(1);
    };

    const id = req.query?.id ? parseInt(req.query.id) : null;

    if (id) {
      const lowerModel = (model || "").toLowerCase();
      if (lowerModel === "projects") {
        const project = await prisma.project.findUnique({
          where: { id },
          include: {
            projectManager: { select: { username: true } },
            projectType: { select: { name: true } },
            projectStatus: { select: { name: true } },
            tasks: {
              include: {
                taskStatus: { select: { name: true } },
                assignees: { select: { username: true } }
              }
            }
          }
        });
        if (!project) {
          return res.status(404).json({ success: false, error: "Project not found" });
        }

        // Title Section
        doc.fillColor("#1e3a8a").fontSize(18).text(`PROJECT REPORT: ${project.name}`, { underline: true });
        doc.moveDown(1);

        // Details
        doc.fillColor("#334155").fontSize(10);
        doc.text(`ID: ${project.id}`);
        doc.text(`Type/Category: ${project.projectType?.name || "—"}`);
        doc.text(`Status: ${project.projectStatus?.name || "—"}`);
        doc.text(`Priority: ${String(project.priority).toUpperCase()}`);
        doc.text(`Project Manager: ${project.projectManager?.username || "Unassigned"}`);
        doc.text(`Timeline: ${formatDate(project.startDate)} to ${formatDate(project.endDate)}`);
        doc.moveDown(1);

        doc.fillColor("#1e3a8a").fontSize(12).text("Description & Scope:");
        doc.fillColor("#475569").fontSize(9).text(project.description || "No description provided.");
        if (project.scope) {
          doc.text(`Scope: ${project.scope}`);
        }
        doc.moveDown(1.5);

        // Project Tasks Table
        const headers = ["ID", "Task Title", "Status", "Priority", "Assignees"];
        const rows = project.tasks.map(t => [
          t.id,
          t.title,
          t.taskStatus?.name || "—",
          t.priority,
          t.assignees.map(a => a.username).join(", ") || "Unassigned"
        ]);
        renderTable("Associated Project Tasks", headers, rows, [40, 180, 100, 80, 130]);
      } else if (lowerModel === "tasks") {
        const task = await prisma.task.findUnique({
          where: { id },
          include: {
            project: { select: { name: true } },
            creator: { select: { username: true } },
            taskStatus: { select: { name: true } },
            assignees: { select: { username: true } },
            subtasks: {
              include: {
                assignedTo: { select: { username: true } }
              }
            },
            timeLogs: {
              include: {
                user: { select: { username: true } }
              }
            }
          }
        });
        if (!task) {
          return res.status(404).json({ success: false, error: "Task not found" });
        }

        // Title Section
        doc.fillColor("#1e3a8a").fontSize(18).text(`TASK REPORT: ${task.title}`, { underline: true });
        doc.moveDown(1);

        // Details
        doc.fillColor("#334155").fontSize(10);
        doc.text(`ID: ${task.id}`);
        doc.text(`Project: ${task.project?.name || "—"}`);
        doc.text(`Status: ${task.taskStatus?.name || "—"}`);
        doc.text(`Priority: ${String(task.priority).toUpperCase()}`);
        doc.text(`Creator: ${task.creator?.username || "—"}`);
        doc.text(`Due Date: ${formatDate(task.dueDate)}`);
        doc.text(`Estimated vs. Actual Hours: ${task.estimatedHours} hrs / ${task.actualHours} hrs`);
        doc.moveDown(1);

        doc.fillColor("#1e3a8a").fontSize(12).text("Description:");
        doc.fillColor("#475569").fontSize(9).text(task.description || "No description provided.");
        doc.moveDown(1.5);

        // Subtasks Table
        if (task.subtasks.length > 0) {
          const subtaskHeaders = ["ID", "Subtask Title", "Status", "Priority", "Assigned To"];
          const subtaskRows = task.subtasks.map(s => [
            s.id,
            s.title,
            s.status,
            s.priority,
            s.assignedTo?.username || "Unassigned"
          ]);
          renderTable("Subtasks List", subtaskHeaders, subtaskRows, [40, 180, 100, 80, 130]);
        }

        // TimeLogs Table
        if (task.timeLogs.length > 0) {
          const timeHeaders = ["ID", "Hours Logged", "Log Date", "User", "Description"];
          const timeRows = task.timeLogs.map(l => [
            l.id,
            l.hoursLogged,
            formatDate(l.logDate),
            l.user?.username || "—",
            l.description || ""
          ]);
          renderTable("Time Log Entries", timeHeaders, timeRows, [40, 80, 100, 100, 210]);
        }
      } else if (lowerModel === "teams") {
        const team = await prisma.team.findUnique({
          where: { id },
          include: {
            teamLead: { select: { username: true } },
            members: {
              include: {
                user: { select: { username: true, email: true, role: true } }
              }
            },
            projectTeams: {
              include: {
                project: { select: { name: true, projectStatus: { select: { name: true } } } }
              }
            }
          }
        });
        if (!team) {
          return res.status(404).json({ success: false, error: "Team not found" });
        }

        // Title Section
        doc.fillColor("#1e3a8a").fontSize(18).text(`TEAM REPORT: ${team.name}`, { underline: true });
        doc.moveDown(1);

        // Details
        doc.fillColor("#334155").fontSize(10);
        doc.text(`ID: ${team.id}`);
        doc.text(`Team Lead: ${team.teamLead?.username || "Unassigned"}`);
        doc.text(`Status: ${team.status}`);
        doc.moveDown(0.5);
        doc.text(`Description: ${team.description || "No description provided."}`);
        doc.moveDown(1.5);

        // Members Table
        const headers = ["Username", "Email", "System Role"];
        const rows = team.members.map(m => [
          m.user?.username || "—",
          m.user?.email || "—",
          m.user?.role || "—"
        ]);
        renderTable("Team Members List", headers, rows, [150, 200, 180]);

        // Projects Table
        if (team.projectTeams.length > 0) {
          const projectHeaders = ["Project Name", "Status"];
          const projectRows = team.projectTeams.map(pt => [
            pt.project?.name || "—",
            pt.project?.projectStatus?.name || "—"
          ]);
          renderTable("Assigned Projects", projectHeaders, projectRows, [300, 230]);
        }
      } else if (lowerModel === "users") {
        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            team: { select: { name: true } },
            projectsManaged: { select: { name: true, projectStatus: { select: { name: true } } } },
            assignedTasks: {
              include: {
                project: { select: { name: true } },
                taskStatus: { select: { name: true } },
              }
            }
          }
        });
        if (!user) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        // Title Section
        doc.fillColor("#1e3a8a").fontSize(18).text(`USER REPORT: ${user.username}`, { underline: true });
        doc.moveDown(1);

        // Details
        doc.fillColor("#334155").fontSize(10);
        doc.text(`ID: ${user.id}`);
        doc.text(`Email: ${user.email}`);
        doc.text(`Role: ${user.role}`);
        doc.text(`Status: ${user.isActive ? "Active" : "Inactive"}`);
        doc.text(`Primary Team: ${user.team?.name || "—"}`);
        doc.moveDown(1.5);

        // Managed Projects Table
        if (user.projectsManaged.length > 0) {
          const headers = ["Managed Project Name", "Status"];
          const rows = user.projectsManaged.map(p => [p.name, p.projectStatus?.name || "—"]);
          renderTable("Managed Projects List", headers, rows, [350, 180]);
        }

        // Assigned Tasks Table
        if (user.assignedTasks.length > 0) {
          const headers = ["Task Title", "Project", "Priority", "Status"];
          const rows = user.assignedTasks.map(t => [
            t.title,
            t.project?.name || "—",
            t.priority,
            t.taskStatus?.name || "—",
          ]);
          renderTable("Assigned Tasks List", headers, rows, [180, 180, 80, 90]);
        }
      }

      doc.end();
    } else {
      if (!model || model === "users") {
        const users = await prisma.user.findMany({ select: { id: true, username: true, email: true, role: true, isActive: true } });
        const headers = ["ID", "Username", "Email", "Role", "Status"];
        const rows = users.map(u => [u.id, u.username, u.email, u.role, u.isActive ? "Active" : "Inactive"]);
        renderTable("Users Directory", headers, rows, [40, 110, 180, 110, 80]);
      }

      if (!model || model === "teams") {
        const teams = await prisma.team.findMany({ include: { teamLead: { select: { username: true } } } });
        const headers = ["ID", "Team Name", "Description", "Status", "Lead"];
        const rows = teams.map(t => [t.id, t.name, t.description || "", t.status, t.teamLead?.username || ""]);
        renderTable("Teams Information", headers, rows, [40, 140, 180, 80, 80]);
      }

      if (!model || model === "projects") {
        const projects = await prisma.project.findMany({
          include: {
            projectManager: { select: { username: true } },
            projectStatus: { select: { name: true } },
          },
        });
        const headers = ["ID", "Project Name", "Priority", "Status", "Manager"];
        const rows = projects.map(p => [p.id, p.name, p.priority, p.projectStatus?.name || "", p.projectManager?.username || ""]);
        renderTable("Projects List", headers, rows, [40, 180, 80, 100, 120]);
      }

      if (!model || model === "tasks") {
        const tasks = await prisma.task.findMany({
          include: {
            project: { select: { name: true } },
            taskStatus: { select: { name: true } },
          },
        });
        const headers = ["ID", "Task Title", "Project", "Status", "Priority"];
        const rows = tasks.map(t => [t.id, t.title, t.project?.name || "", t.taskStatus?.name || "", t.priority]);
        renderTable("Tasks Directory", headers, rows, [40, 180, 140, 100, 60]);
      }

      doc.end();
    }
  } catch (err) {
    next(err);
  }
}

const backupsDir = path.join(__dirname, "..", "..", "backups");

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Private helper to capture a full database backup locally
async function saveDatabaseSnapshotToFile(filePath) {
  const { Prisma } = require("@prisma/client");
  const models = Prisma?.dmmf?.datamodel?.models || [];
  if (models.length === 0) {
    throw new Error("Prisma models not found in DMMF.");
  }

  const data = {};
  for (const m of models) {
    const delegate = prisma[lowerFirst(m.name)];
    if (!delegate || typeof delegate.findMany !== "function") continue;
    data[m.name] = await delegate.findMany();
  }

  const payload = {
    format: "prisma-json-backup",
    database: "qeema",
    exportedAt: new Date().toISOString(),
    modelCount: Object.keys(data).length,
    data,
  };

  const { prismaJsonReplacer, atomicWriteFile } = require("../../scripts/db-backup-helpers");
  const json = JSON.stringify(payload, prismaJsonReplacer, 2);
  atomicWriteFile(filePath, json);
}

// 1. Export Database
async function exportDatabase(req, res, next) {
  try {
    const { Prisma } = require("@prisma/client");
    const models = Prisma?.dmmf?.datamodel?.models || [];
    if (models.length === 0) {
      return res.status(500).json({ success: false, error: "Prisma models not found in DMMF." });
    }

    const data = {};
    for (const m of models) {
      const delegate = prisma[lowerFirst(m.name)];
      if (!delegate || typeof delegate.findMany !== "function") continue;
      data[m.name] = await delegate.findMany();
    }

    const payload = {
      format: "prisma-json-backup",
      database: "qeema",
      exportedAt: new Date().toISOString(),
      modelCount: Object.keys(data).length,
      data,
    };

    const { prismaJsonReplacer } = require("../../scripts/db-backup-helpers");
    const json = JSON.stringify(payload, prismaJsonReplacer, 2);

    res.setHeader("Content-Disposition", `attachment; filename="qeema_database_backup_${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    return res.send(json);
  } catch (err) {
    next(err);
  }
}

// 2. Import/Restore Database (Transactional with auto-rollback snapshot)
async function importDatabase(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No backup file uploaded" });
  }

  try {
    const payloadStr = req.file.buffer.toString("utf8");
    const { prismaJsonReviver } = require("../../scripts/db-backup-helpers");
    const payload = JSON.parse(payloadStr, prismaJsonReviver);

    if (!payload || payload.format !== "prisma-json-backup" || !payload.data) {
      return res.status(400).json({ success: false, error: "Invalid backup format. Must be a prisma-json-backup." });
    }

    const { Prisma } = require("@prisma/client");
    const models = Prisma?.dmmf?.datamodel?.models || [];

    // Trigger pre-restore safety rollback snapshot
    const preRestoreFilename = `db_backup_pre_restore_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const preRestoreFilePath = path.join(backupsDir, preRestoreFilename);
    try {
      await saveDatabaseSnapshotToFile(preRestoreFilePath);
      console.log(`[Database Import] Pre-restore backup created successfully: ${preRestoreFilename}`);
    } catch (e) {
      console.error(`[Database Import] Pre-restore backup failed:`, e.message);
    }

    // Execute inside a single transactional context
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0;");
      try {
        for (const m of models) {
          const delegate = tx[lowerFirst(m.name)];
          if (!delegate || typeof delegate.deleteMany !== "function") continue;
          await delegate.deleteMany();
        }

        for (const m of models) {
          const rows = payload.data[m.name];
          if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
          const delegate = tx[lowerFirst(m.name)];
          if (!delegate || typeof delegate.createMany !== "function") continue;

          const chunkSize = 500;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            await delegate.createMany({ data: chunk });
          }
        }
      } finally {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1;");
      }
    }, {
      timeout: 60000
    });

    return res.status(200).json({
      success: true,
      message: "Database successfully restored from backup.",
    });
  } catch (err) {
    next(err);
  }
}

// 3. List local backups
async function listLocalBackups(req, res, next) {
  try {
    if (!fs.existsSync(backupsDir)) {
      return res.status(200).json({ success: true, backups: [] });
    }

    const files = fs.readdirSync(backupsDir);
    const backups = files
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const filePath = path.join(backupsDir, f);
        const stats = fs.statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return res.status(200).json({ success: true, backups });
  } catch (err) {
    next(err);
  }
}

// 4. Create local backup
async function createLocalBackup(req, res, next) {
  try {
    const filename = `db_backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filePath = path.join(backupsDir, filename);

    await saveDatabaseSnapshotToFile(filePath);

    return res.status(201).json({
      success: true,
      message: "Database backup created successfully on server.",
      backup: {
        filename,
        size: fs.statSync(filePath).size,
        createdAt: new Date().toISOString(),
      }
    });
  } catch (err) {
    next(err);
  }
}

// 5. Restore from local backup (Transactional with auto-rollback snapshot)
async function restoreLocalBackup(req, res, next) {
  const { filename } = req.params;
  const filePath = path.join(backupsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "Backup file not found" });
  }

  try {
    const payloadStr = fs.readFileSync(filePath, "utf8");
    const { prismaJsonReviver } = require("../../scripts/db-backup-helpers");
    const payload = JSON.parse(payloadStr, prismaJsonReviver);

    if (!payload || payload.format !== "prisma-json-backup" || !payload.data) {
      return res.status(400).json({ success: false, error: "Invalid backup format in file" });
    }

    const { Prisma } = require("@prisma/client");
    const models = Prisma?.dmmf?.datamodel?.models || [];

    // Trigger pre-restore safety rollback snapshot
    const preRestoreFilename = `db_backup_pre_restore_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const preRestoreFilePath = path.join(backupsDir, preRestoreFilename);
    try {
      await saveDatabaseSnapshotToFile(preRestoreFilePath);
      console.log(`[Database Restore] Pre-restore backup created successfully: ${preRestoreFilename}`);
    } catch (e) {
      console.error(`[Database Restore] Pre-restore backup failed:`, e.message);
    }

    // Execute inside a single transactional context
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0;");
      try {
        for (const m of models) {
          const delegate = tx[lowerFirst(m.name)];
          if (!delegate || typeof delegate.deleteMany !== "function") continue;
          await delegate.deleteMany();
        }

        for (const m of models) {
          const rows = payload.data[m.name];
          if (!rows || !Array.isArray(rows) || rows.length === 0) continue;
          const delegate = tx[lowerFirst(m.name)];
          if (!delegate || typeof delegate.createMany !== "function") continue;

          const chunkSize = 500;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            await delegate.createMany({ data: chunk });
          }
        }
      } finally {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1;");
      }
    }, {
      timeout: 60000
    });

    return res.status(200).json({
      success: true,
      message: `Database successfully restored from local backup: ${filename}`,
    });
  } catch (err) {
    next(err);
  }
}

// 6. Delete local backup
async function deleteLocalBackup(req, res, next) {
  const { filename } = req.params;
  const filePath = path.join(backupsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "Backup file not found" });
  }

  try {
    fs.unlinkSync(filePath);
    return res.status(200).json({ success: true, message: `Backup file ${filename} deleted successfully.` });
  } catch (err) {
    next(err);
  }
}

// 7. Daily Backup Job
async function runDailyBackupJob() {
  try {
    console.log("[Daily Backup Job] Triggering automatic database backup...");
    const filename = `db_backup_daily_${new Date().toISOString().slice(0, 10)}.json`;
    const filePath = path.join(backupsDir, filename);

    await saveDatabaseSnapshotToFile(filePath);
    console.log(`[Daily Backup Job] Automatic backup created successfully: ${filename}`);

    // Cleanup backups older than 7 days
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir);
      const now = Date.now();
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

      files.forEach(f => {
        if (f.endsWith(".json")) {
          const fileP = path.join(backupsDir, f);
          const stats = fs.statSync(fileP);
          if (now - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(fileP);
            console.log(`[Daily Backup Job] Cleaned up old backup: ${f}`);
          }
        }
      });
    }
  } catch (err) {
    console.error("[Daily Backup Job] Failed to run daily backup:", err);
  }
}

module.exports = {
  exportExcel,
  importExcel,
  exportPDF,
  exportDatabase,
  importDatabase,
  listLocalBackups,
  createLocalBackup,
  restoreLocalBackup,
  deleteLocalBackup,
  runDailyBackupJob,
};

