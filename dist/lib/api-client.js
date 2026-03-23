/**
 * api-client.js — Echo360 Cloud REST API wrapper
 * Mirrors EchoCloudCourse._get_course_data() in echo360/course.py
 *
 * fetch() uses credentials: 'include' so the browser automatically sends
 * the ECHO_JWT and session cookies — no manual cookie copying needed.
 * Extensions bypass CORS for declared host_permissions.
 */

export class EchoApiClient {
  /**
   * @param {string} hostname - e.g. "https://echo360.org"
   */
  constructor(hostname) {
    this.hostname = hostname.replace(/\/$/, '');
  }

  /**
   * Fetch the course syllabus (list of all lessons).
   * GET /section/{sectionId}/syllabus → { data: [...lesson objects...] }
   * Mirrors EchoCloudCourse._get_course_data() in echo360/course.py
   * @param {string} sectionId - UUID
   * @returns {Promise<object>}
   */
  async fetchSyllabus(sectionId) {
    const url = `${this.hostname}/section/${sectionId}/syllabus`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Syllabus fetch failed: ${res.status} for ${url}`);
    return res.json();
  }

  async fetchEnrollments() {
    const url = `${this.hostname}/user/enrollments`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Enrollments fetch failed: ${res.status} for ${url}`);
    return res.json();
  }

  /**
   * Fetch the HTML of a classroom page (fallback Methods 3 & 4).
   * Uses lesson.lesson.id from the syllabus item — NOT the groupId from data-test-lessonid.
   * URL: /lesson/{classroomLessonId}/classroom  (a rendered HTML page, not a JSON API)
   * Mirrors: EchoCloudVideo.video_url property in videos.py:220
   * @param {string} classroomLessonId - lesson.lesson.id from syllabus
   * @returns {Promise<string>}
   */
  async fetchClassroomHtml(classroomLessonId) {
    const url = `${this.hostname}/lesson/${classroomLessonId}/classroom`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`Classroom fetch failed: ${res.status} for ${url}`);
    return res.text();
  }

  // NOTE: There is NO /lesson/{id} JSON API endpoint in Echo360.
  // All video metadata is obtained from the syllabus endpoint above.
  // The Python code (EchoCloudCourse) uses the syllabus JSON directly —
  // it never calls a per-lesson JSON endpoint.
}
