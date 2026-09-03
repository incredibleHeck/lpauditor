/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Google Apps Script to automatically generate the St. Adelaide Faculty Email & Login Intake Form
 * 
 * Instructions:
 * 1. Go to https://script.google.com and click "New project".
 * 2. Replace the editor contents with this script.
 * 3. Click "Run" (createFacultyEmailIntakeForm).
 * 4. Grant required permissions when prompted.
 * 5. View the Execution Log (Ctrl + Enter) to get the Published Form URL and Editor URL.
 * 6. Under the "Responses" tab of the Google Form, link to Google Sheets.
 * 7. When teachers submit, download the sheet as "faculty_responses.csv" and place in the project root.
 */

function createFacultyEmailIntakeForm() {
  const form = FormApp.create('St. Adelaide Faculty Email & Login Setup')
    .setDescription(
      'Welcome to the St. Adelaide Lesson Plan Auditor (LPAuditor) portal setup.\n\n' +
      'Please select your official name from the timetable roster and confirm your official ' +
      '@stadelaideschool.com email address. Your account and weekly lesson plan quotas will be provisioned automatically.\n\n' +
      '⚠️ IMPORTANT NOTICE: New teachers who do not have their school email set up for them yet should see Aunty Franca in the office to get it set up for them before close of day.'
    )
    .setProgressBar(true);

  // Exact Primary & Secondary faculty names + School-Wide Administrators
  const facultyNames = [
    // School-Wide Administrators
    "Prince Dunyoh",
    "Theodora Hammond",
    "Mr. Ayiku",

    // Sectional HODs & Teaching Faculty
    "Mrs. Pauline Asante-Nti",
    "Mrs. Abigail Sackey",
    "Mrs. Joana Asiedua Amoh-Barimah",

    // Primary & Secondary Teaching Staff
    "Mrs. Promise Ankrah",
    "Mr. Derrick Thompson",
    "Mr. James Tettey",
    "Mr. Joseph Liman",
    "Mrs. Victoria Ansah",
    "Samuel",
    "Mariama Zachari",
    "Mrs. Erica Frempong Eyiah",
    "Mrs. Vida Darko Mensah",
    "Mrs. Serwaa Sampson",
    "Miss Roselyn Otabil",
    "Ms. Anita Bilekyi",
    "Dorcas Egbetta",
    "Mrs. Evelyn Bonnie",
    "Mr. Eric Dzidzornu",
    "Mr. William Dickson",
    "Miss Gloria Cofie",
    "Mary Sekafa",
    "Mrs. Dorcas Livingston",
    "Mrs. Ama Kwatsewaa Opong-Nyarko",
    "Mr. Sebastian Adu",
    "Mr. Jerome Batalina",
    "Francisca Fukour",
    "Miss Bridget Boboli",
    "Miss Ruth Lartey",
    "Gifty",
    "Augustina Baah",
    "Abigail Andoh",
    "Mrs. Dorcas Addy",
    "Mr. Dickson Narh",
    "Felix Agyemang Kumoji",
    "Jacqueline Somuah",
    "Mrs. Veronica Agyekum Wire"
  ].sort();

  // 1. Name Selection (Dropdown list prevents spelling mistakes)
  form.addListItem()
    .setTitle('Select Your Official Full Name')
    .setHelpText('Choose your name exactly as listed on the official school timetable.')
    .setChoiceValues(facultyNames)
    .setRequired(true);

  // 2. Official Email Validation
  const emailValidation = FormApp.createTextValidation()
    .requireTextMatchesPattern('^[a-zA-Z0-9._%+-]+@stadelaideschool\\.com$')
    .setHelpText('Please enter a valid @stadelaideschool.com email address.')
    .build();

  form.addTextItem()
    .setTitle('Official School Email Address')
    .setHelpText(
      'This will be your permanent login ID for the LPAuditor platform.\n' +
      'Note: New teachers who do not have their school email set up yet must see Aunty Franca in the office before close of day to get it created.'
    )
    .setValidation(emailValidation)
    .setRequired(true);

  // 3. WhatsApp Contact
  form.addTextItem()
    .setTitle('Phone Number / WhatsApp')
    .setHelpText('Optional: Used for urgent timetable notifications and Friday compliance alerts.')
    .setRequired(false);

  Logger.log('🎉 Form Created Successfully!');
  Logger.log('🔗 Published Link: ' + form.getPublishedUrl());
  Logger.log('✏️  Editor Link: ' + form.getEditUrl());
}
