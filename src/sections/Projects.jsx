import SectionWrapper from '../components/SectionWrapper'
import ProjectCard from '../components/ProjectCard'
import { projects } from '../data/content'

function Projects() {
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
          />
        ))}
      </div>
    </SectionWrapper>
  )
}

export default Projects