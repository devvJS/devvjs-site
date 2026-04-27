import { useEffect, useState } from 'react'
import SectionWrapper from '../components/SectionWrapper'
import ProjectCard from '../components/ProjectCard'
import { projects as seedProjects } from '../data/content'

function Projects() {
  const [projects, setProjects] = useState(seedProjects)

  useEffect(() => {
    let cancelled = false
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.projects?.length) return
        setProjects(data.projects)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <SectionWrapper id="projects" title="projects">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {projects.map((project) => (
          <ProjectCard
            key={project.title}
            title={project.title}
            description={project.description}
            tags={project.tags}
            liveUrl={project.liveUrl}
            repoUrl={project.repoUrl}
            stars={project.stars}
            language={project.language}
            updatedAt={project.updatedAt}
          />
        ))}
      </div>
    </SectionWrapper>
  )
}

export default Projects
